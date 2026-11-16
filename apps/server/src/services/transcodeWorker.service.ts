import { pool } from '../db/pool.js';

const WORKER_ID = `server-worker-${process.pid}-${Date.now().toString(36)}`;

export async function processNextTranscodeJob(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Claim next pending job atomically
    const claimRes = await client.query(
      `SELECT id, room_id, user_id, storage_key, original_filename, retry_count, max_retries
       FROM uploads
       WHERE status = 'pending' AND retry_count < max_retries
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`
    );

    if (claimRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const job = claimRes.rows[0];

    // Mark processing and lock
    await client.query(
      `UPDATE uploads
       SET status = 'processing',
           locked_by_worker = $1,
           locked_at = NOW(),
           progress_percentage = 10
       WHERE id = $2`,
      [WORKER_ID, job.id]
    );

    await client.query('COMMIT');
    console.log(`[EmbeddedWorker] Claimed job ${job.id} for file ${job.original_filename}`);

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[EmbeddedWorker] Error claiming job:', err);
    return false;
  } finally {
    client.release();
  }
}

export function startEmbeddedWorker(intervalMs = 5000) {
  console.log(`[EmbeddedWorker] Transcoding queue processor active.`);
  setInterval(async () => {
    try {
      await processNextTranscodeJob();
    } catch (err) {
      console.error('[EmbeddedWorker] Poll error:', err);
    }
  }, intervalMs);
}
