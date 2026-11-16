import http from 'http';
import { app } from './app.js';
import { initSocketServer } from './socket/socketServer.js';
import { runMigrations } from './db/migrate.js';
import { startEmbeddedWorker } from './services/transcodeWorker.service.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = initSocketServer(server);

async function start() {
  if (process.env.DATABASE_URL) {
    try {
      console.log('Verifying and applying database schema migrations...');
      await runMigrations();
    } catch (err: any) {
      console.error('CRITICAL: Auto-migration failed:', err?.message || err);
    }
  }

  server.listen(PORT, () => {
    console.log(`Server and Socket.IO engine listening on port ${PORT}`);
    if (process.env.RUN_EMBEDDED_WORKER === 'true') {
      startEmbeddedWorker();
    }
  });
}

start();

export { server, io };
