import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { MediaAuthService } from '../services/mediaAuth.service.js';
import { RoomService } from '../services/room.service.js';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

export const hlsGatewayRouter = Router();

hlsGatewayRouter.get('/:uploadId/token', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const sessionToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const session = await RoomService.verifySession(sessionToken);
    if (!session) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // Verify upload belongs to user's current room
    const uploadRes = await pool.query(
      `SELECT u.id, u.room_id, r.media_secret, r.media_epoch
       FROM uploads u
       JOIN rooms r ON r.id = u.room_id
       WHERE u.id = $1`,
      [uploadId]
    );

    if (uploadRes.rows.length === 0 || uploadRes.rows[0].room_id !== session.room_id) {
      return res.status(404).json({ error: 'MEDIA_NOT_FOUND' });
    }

    const { media_secret, media_epoch } = uploadRes.rows[0];

    const token = MediaAuthService.mintToken(
      uploadId,
      session.room_id,
      session.user_id,
      media_epoch,
      media_secret,
      20 // 20 minutes
    );

    // Set cookie for Native Safari AVFoundation
    res.cookie('__Host-Media-Token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/hls/',
      maxAge: 20 * 60 * 1000,
    });

    return res.json({
      token,
      expiresInMinutes: 20,
    });
  } catch (err) {
    console.error('Error issuing HLS token:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});
