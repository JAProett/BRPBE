import pool from '../db.js';

// Submit a new report
export async function submitReport({
  segment_id,
  reported_status,
  device_hash
}) {
  await pool.query(
    `
    INSERT INTO road_reports (segment_id, reported_status, device_hash, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (device_hash, segment_id)
    DO UPDATE SET
      reported_status = EXCLUDED.reported_status,
      created_at = NOW()
    `,
    [segment_id, reported_status, device_hash]
  );

  const summary = await getSummary(segment_id);

  return {
    success: true,
    message: 'Updated your report',
    summary
  };
}

// Get aggregated summary
export async function getSummary(segment_id) {
  const result = await pool.query(
    `
    WITH recent_reports AS (
      SELECT
        reported_status,
        created_at,
        CASE
          WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1.0
          WHEN created_at >= NOW() - INTERVAL '3 hours' THEN 0.6
          WHEN created_at >= NOW() - INTERVAL '6 hours' THEN 0.3
          ELSE 0
        END as weight
      FROM road_reports
      WHERE segment_id = $1
        AND created_at >= NOW() - INTERVAL '6 hours'
    ),
    totals AS (
      SELECT
        SUM(CASE WHEN reported_status = 'open' THEN weight ELSE 0 END) as open_score,
        SUM(CASE WHEN reported_status = 'closed' THEN weight ELSE 0 END) as closed_score,
        SUM(CASE WHEN reported_status = 'ungated' THEN weight ELSE 0 END) as ungated_score,
        SUM(CASE WHEN reported_status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN reported_status = 'closed' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN reported_status = 'ungated' THEN 1 ELSE 0 END) as ungated_count,
        COUNT(*) as report_count,
        MAX(created_at) as last_reported_at
      FROM recent_reports
    )
    SELECT * FROM totals;
    `,
    [segment_id]
  );

  const row = result.rows[0];

  let user_status = 'no_reports';

  if (row.report_count > 0) {
    if (row.open_score > row.closed_score * 1.5) {
      user_status = 'likely_open';
    } else if (row.closed_score > row.open_score * 1.5) {
      user_status = 'likely_closed';
    } else {
      user_status = 'mixed_reports';
    }
  }

  return {
    segment_id,
    user_status,
    report_count: row.report_count,
    open_score: row.open_score,
    closed_score: row.closed_score,
    ungated_score: row.ungated_score,
    open_count: row.open_count,
    closed_count: row.closed_count,
    ungated_count: row.ungated_count,
    last_reported_at: row.last_reported_at
  };
}