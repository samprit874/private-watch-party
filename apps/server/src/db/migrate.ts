import { pool } from './pool.js';
import { SCHEMA_SQL } from './schema.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const client = await pool.connect();
  try {
    let sql = SCHEMA_SQL;

    // Optional override from disk if available
    try {
      const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
      const fileSql = await fs.readFile(migrationPath, 'utf-8');
      if (fileSql && fileSql.trim().length > 0) {
        sql = fileSql;
      }
    } catch {
      // Fallback to embedded SCHEMA_SQL
    }

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS join_code VARCHAR(6);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_rooms_join_code ON rooms(join_code);');
    await client.query('COMMIT');
    console.log('Successfully applied database schema migrations.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}
