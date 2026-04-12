import pool from '../db.js';

export async function canSubmitReport(segment_id, device_hash) {
  const result = await pool.query(
    `
    SELECT created_at
    FROM road_reports
    WHERE segment_id = $1
      AND device_hash = $2
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [segment_id, device_hash]
  );

  if (result.rows.length === 0) return true;

  const lastReport = new Date(result.rows[0].created_at);
  const now = new Date();

  const diffHours = (now - lastReport) / (1000 * 60 * 60);

  return diffHours > 4; // 4 hour cooldown
}