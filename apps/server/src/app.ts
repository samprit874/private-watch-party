import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { roomRouter } from './routes/room.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { livekitRouter } from './routes/livekit.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { hlsGatewayRouter } from './routes/hlsGateway.routes.js';

export const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Routes
app.use('/api/rooms', roomRouter);
app.use('/api/rooms', livekitRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/media/hls', hlsGatewayRouter);
app.use('/api/media', mediaRouter);
