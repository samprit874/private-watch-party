import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { roomRouter } from './routes/room.routes.js';

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

// Room routes
app.use('/api/rooms', roomRouter);
