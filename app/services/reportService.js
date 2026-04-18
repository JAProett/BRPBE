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
    WITH latest_reports AS (
      SELECT DISTINCT ON (device_hash, segment_id)
        device_hash,
        segment_id,
        reported_status,
        created_at,
        CASE
          WHEN created_at >= NOW() - INTERVAL '6 hours' THEN 1.0
          WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 0.7
          WHEN created_at >= NOW() - INTERVAL '48 hours' THEN 0.4
          WHEN created_at >= NOW() - INTERVAL '72 hours' THEN 0.2
          ELSE 0
        END AS weight
      FROM road_reports
      WHERE segment_id = $1
        AND created_at >= NOW() - INTERVAL '72 hours'
      ORDER BY device_hash, segment_id, created_at DESC
    ),
    totals AS (
      SELECT
        COALESCE(SUM(CASE WHEN reported_status = 'open' THEN weight ELSE 0 END), 0) AS open_score,
        COALESCE(SUM(CASE WHEN reported_status = 'closed' THEN weight ELSE 0 END), 0) AS closed_score,
        COALESCE(SUM(CASE WHEN reported_status = 'ungated' THEN weight ELSE 0 END), 0) AS ungated_score,
        COALESCE(SUM(CASE WHEN reported_status = 'open' THEN 1 ELSE 0 END), 0) AS open_count,
        COALESCE(SUM(CASE WHEN reported_status = 'closed' THEN 1 ELSE 0 END), 0) AS closed_count,
        COALESCE(SUM(CASE WHEN reported_status = 'ungated' THEN 1 ELSE 0 END), 0) AS ungated_count,
        COUNT(*) AS report_count,
        MAX(created_at) AS last_reported_at
      FROM latest_reports
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