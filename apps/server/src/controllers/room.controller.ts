import { Request, Response } from 'express';
import { z } from 'zod';
import { RoomService } from '../services/room.service.js';
import { extractSessionToken } from '../utils/auth.js';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

const CreateRoomSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(64),
  title: z.string().max(128).optional(),
});

const JoinRoomSchema = z.object({
  inviteToken: z.string().min(16, 'Invalid invite token'),
  displayName: z.string().min(1, 'Display name is required').max(64),
});

export class RoomController {
  static async createRoom(req: Request, res: Response) {
    try {
      const parsed = CreateRoomSchema.parse(req.body);
      const result = await RoomService.createRoom(parsed);

      // Set HttpOnly secure session cookie
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      return res.status(201).json({
        roomId: result.roomId,
        slug: result.slug,
        inviteToken: result.inviteToken,
        sessionToken: result.sessionToken,
        hostUser: result.hostUser,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      }
      console.error('Error creating room:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: (err as any)?.message || 'Database error while creating room',
      });
    }
  }

  static async getInviteDetails(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: 'TOKEN_REQUIRED' });
      }

      const room = await RoomService.getRoomByInviteToken(token);
      if (!room) {
        return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
      }

      return res.json(room);
    } catch (err) {
      console.error('Error getting invite details:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async joinRoom(req: Request, res: Response) {
    try {
      const parsed = JoinRoomSchema.parse(req.body);
      const result = await RoomService.joinRoom(parsed);

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        roomId: result.roomId,
        slug: result.slug,
        sessionToken: result.sessionToken,
        user: result.user,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      }

      if (err.message === 'ROOM_NOT_FOUND') {
        return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
      }
      if (err.message === 'ROOM_LOCKED') {
        return res.status(403).json({ error: 'ROOM_LOCKED' });
      }
      if (err.message === 'ROOM_EXPIRED') {
        return res.status(410).json({ error: 'ROOM_EXPIRED' });
      }
      if (err.message === 'ROOM_CAPACITY_EXCEEDED' || err.message?.includes('ROOM_CAPACITY_EXCEEDED')) {
        return res.status(409).json({ error: 'ROOM_CAPACITY_EXCEEDED', message: 'Room has reached the maximum of 3 participants' });
      }

      console.error('Error joining room:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async getSession(req: Request, res: Response) {
    try {
      const sessionToken = extractSessionToken(req);
      if (!sessionToken) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      const session = await RoomService.verifySession(sessionToken);
      if (!session) {
        return res.status(401).json({ error: 'INVALID_SESSION' });
      }

      return res.json(session);
    } catch (err) {
      console.error('Error verifying session:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
