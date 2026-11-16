import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { pool } from './db/pool.js';
import { roomRouter } from './routes/room.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { livekitRouter } from './routes/livekit.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { hlsGatewayRouter } from './routes/hlsGateway.routes.js';

export const app = express();

app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Root & Health check
app.get('/', (_req, res) => {
  res.json({
    service: 'Private Watch Party API & Sync Engine',
    status: 'online',
    health: '/health',
  });
});

app.get('/health', async (_req, res) => {
  let dbStatus = 'unconfigured';
  let tableCount = 0;
  if (process.env.DATABASE_URL) {
    try {
      const dbRes = await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'");
      dbStatus = 'connected';
      tableCount = parseInt(dbRes.rows[0]?.count || '0', 10);
    } catch (err: any) {
      dbStatus = `disconnected: ${err?.message || err}`;
    }
  }

  res.json({
    status: 'ok',
    db: dbStatus,
    tableCount,
    timestamp: Date.now(),
  });
});

// Direct Video Uploads Static Serving with CORS and Byte-Range Support
const uploadsDir = path.join(os.tmpdir(), 'watchparty', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch {
  // ignore if already exists
}

app.use('/api/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}, express.static(uploadsDir, {
  acceptRanges: true,
}));

app.use('/api/rooms', roomRouter);
app.use('/api/rooms', livekitRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/media/hls', hlsGatewayRouter);
app.use('/api/media', mediaRouter);
