import pg from 'pg';
import dotenv from 'dotenv';
import { Transcoder } from './transcoder.js';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/watchparty',
});

const WORKER_ID = `worker-${process.pid}-${Date.now().toString(36)}`;

export async function processNextJob(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Claim next pending job atomically
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
      return false; // No work pending
    }

    const job = claimRes.rows[0];

    // 2. Mark processing and lock
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
    console.log(`[Worker] Claimed job ${job.id} for file ${job.original_filename}`);

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Worker] Error claiming job:', err);
    return false;
  } finally {
    client.release();
  }
}

// Background poll loop
export async function startWorker(intervalMs = 5000) {
  console.log(`[Worker] Started transcode worker ${WORKER_ID}`);
  setInterval(async () => {
    try {
      await processNextJob();
    } catch (err) {
      console.error('[Worker] Poll loop error:', err);
    }
  }, intervalMs);
}
