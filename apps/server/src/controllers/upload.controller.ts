import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { pool } from '../db/pool.js';
import { StorageService } from '../services/storage.service.js';
import { RoomService } from '../services/room.service.js';
import { extractSessionToken } from '../utils/auth.js';

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
];

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 * 1024; // 4GB

const InitUploadSchema = z.object({
  roomId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES, 'File size exceeds 4GB limit'),
  mimeType: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val), {
    message: 'Unsupported video format. Allowed: MP4, WebM, MOV, MKV',
  }),
});

const FinalizeUploadSchema = z.object({
  uploadId: z.string().uuid(),
});

export class UploadController {
  static async initUpload(req: Request, res: Response) {
    try {
      const sessionToken = extractSessionToken(req);
      if (!sessionToken) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      const session = await RoomService.verifySession(sessionToken);
      if (!session) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      const { roomId, filename, fileSizeBytes, mimeType } = InitUploadSchema.parse(req.body);

      if (session.room_id !== roomId) {
        return res.status(403).json({ error: 'ROOM_MISMATCH' });
      }

      // Generate upload record in DB
      const uploadRes = await pool.query(
        `INSERT INTO uploads (room_id, user_id, original_filename, storage_key, file_size_bytes, status)
         VALUES ($1, $2, $3, 'pending', $4, 'pending')
         RETURNING id`,
        [roomId, session.user_id, filename, fileSizeBytes]
      );
      const uploadId = uploadRes.rows[0].id;

      // Generate pre-signed URL
      const presigned = await StorageService.createPresignedUploadUrl(roomId, uploadId, filename, mimeType);

      // Update storage key in database
      await pool.query(
        `UPDATE uploads SET storage_key = $1 WHERE id = $2`,
        [presigned.storageKey, uploadId]
      );

      return res.status(201).json({
        uploadId,
        uploadUrl: presigned.uploadUrl,
        storageKey: presigned.storageKey,
        expiresInSeconds: presigned.expiresInSeconds,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      }
      console.error('Error initiating upload:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async finalizeUpload(req: Request, res: Response) {
    try {
      const sessionToken = extractSessionToken(req);
      if (!sessionToken) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      const session = await RoomService.verifySession(sessionToken);
      if (!session) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      const { uploadId } = FinalizeUploadSchema.parse(req.body);

      const updateRes = await pool.query(
        `UPDATE uploads
         SET status = 'completed', progress_percentage = 100
         WHERE id = $1 AND user_id = $2
         RETURNING id, room_id, original_filename, storage_key`,
        [uploadId, session.user_id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ error: 'UPLOAD_NOT_FOUND' });
      }

      const upload = updateRes.rows[0];
      const sanitized = upload.original_filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const backendUrl = process.env.PUBLIC_SERVER_URL || 'https://watchparty-server-6a3v.onrender.com';
      const streamUrl = `${backendUrl}/api/uploads/${uploadId}/${sanitized}`;

      return res.json({
        status: 'ready',
        uploadId,
        streamUrl,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      }
      console.error('Error finalizing upload:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async directUpload(req: Request, res: Response) {
    try {
      const { uploadId } = req.params;
      const filename = (req.query.filename as string) || 'video.mp4';
      const uploadDir = path.join(os.tmpdir(), 'watchparty', 'uploads', uploadId);
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);

      const writeStream = createWriteStream(filePath);
      req.pipe(writeStream);

      writeStream.on('finish', () => {
        res.status(200).json({ status: 'uploaded', path: filePath });
      });

      writeStream.on('error', (err) => {
        console.error('Direct upload stream error:', err);
        res.status(500).json({ error: 'FILE_WRITE_ERROR' });
      });
    } catch (err: any) {
      console.error('Direct upload error:', err);
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
