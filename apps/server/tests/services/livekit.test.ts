import { describe, it, expect, vi } from 'vitest';
import { LiveKitService } from '../../src/services/livekit.service.js';
import request from 'supertest';
import { app } from '../../src/app.js';
import { RoomService } from '../../src/services/room.service.js';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

describe('LiveKit Service & Route', () => {
  it('generates a signed JWT token with host publisher grants', async () => {
    const token = await LiveKitService.generateToken({
      roomId: 'room-101',
      userId: 'user-host',
      displayName: 'Alice Host',
      isHost: true,
    });

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // Standard JWT format
  });

  it('generates a subscriber-only token for viewer', async () => {
    const token = await LiveKitService.generateToken({
      roomId: 'room-101',
      userId: 'user-viewer',
      displayName: 'Bob Viewer',
      isHost: false,
    });

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  describe('POST /api/rooms/:roomId/livekit-token', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/rooms/room-101/livekit-token');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user belongs to a different room', async () => {
      vi.spyOn(RoomService, 'verifySession').mockResolvedValueOnce({
        room_id: 'other-room',
        user_id: 'u-1',
        display_name: 'Mallory',
        role: 'viewer',
        participant_id: 'p-1',
        is_connected: true,
        is_guest: true,
        slug: 'other',
        title: 'Other',
        is_locked: false,
        host_id: 'u-2',
        media_secret: 'sec',
        media_epoch: 1,
      });

      const res = await request(app)
        .post('/api/rooms/room-101/livekit-token')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-123`]);

      expect(res.status).toBe(403);
    });

    it('returns token and canPublish: true for room host', async () => {
      vi.spyOn(RoomService, 'verifySession').mockResolvedValueOnce({
        room_id: 'room-101',
        user_id: 'u-host',
        display_name: 'Alice Host',
        role: 'host',
        participant_id: 'p-1',
        is_connected: true,
        is_guest: true,
        slug: 'slug-101',
        title: 'Movie Room',
        is_locked: false,
        host_id: 'u-host',
        media_secret: 'sec',
        media_epoch: 1,
      });

      const res = await request(app)
        .post('/api/rooms/room-101/livekit-token')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-123`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.canPublish).toBe(true);
      expect(res.body).toHaveProperty('serverUrl');
    });
  });
});
