import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { RoomService } from '../../src/services/room.service.js';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

describe('Room Controller & Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 and ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /api/rooms', () => {
    it('creates room and sets session cookie', async () => {
      vi.spyOn(RoomService, 'createRoom').mockResolvedValue({
        roomId: 'room-123',
        slug: 'slug-abc',
        inviteToken: 'raw-invite-token-64chars',
        sessionToken: 'raw-session-token-64chars',
        hostUser: { id: 'user-1', displayName: 'Host Alice' },
      });

      const res = await request(app)
        .post('/api/rooms')
        .send({ displayName: 'Host Alice', title: 'Movie Night' });

      expect(res.status).toBe(201);
      expect(res.body.roomId).toBe('room-123');
      expect(res.body.slug).toBe('slug-abc');
      expect(res.body.inviteToken).toBe('raw-invite-token-64chars');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain(SESSION_COOKIE_NAME);
    });

    it('rejects empty display name with 400', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ displayName: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/rooms/invite/:token', () => {
    it('returns room details when invite token is valid', async () => {
      vi.spyOn(RoomService, 'getRoomByInviteToken').mockResolvedValue({
        id: 'room-123',
        slug: 'slug-abc',
        title: 'Movie Night',
        isLocked: false,
        maxParticipants: 3,
        activeParticipantsCount: 1,
        isFull: false,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await request(app).get('/api/rooms/invite/valid-token-12345678');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('room-123');
      expect(res.body.isFull).toBe(false);
      expect(res.body.activeParticipantsCount).toBe(1);
    });

    it('returns 404 when invite token not found', async () => {
      vi.spyOn(RoomService, 'getRoomByInviteToken').mockResolvedValue(null);

      const res = await request(app).get('/api/rooms/invite/unknown-token');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('POST /api/rooms/join', () => {
    it('joins room and sets session cookie for viewer', async () => {
      vi.spyOn(RoomService, 'joinRoom').mockResolvedValue({
        roomId: 'room-123',
        slug: 'slug-abc',
        sessionToken: 'viewer-session-token',
        user: { id: 'viewer-2', displayName: 'Bob Viewer', role: 'viewer' },
      });

      const res = await request(app)
        .post('/api/rooms/join')
        .send({ inviteToken: 'valid-token-12345678', displayName: 'Bob Viewer' });

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe('room-123');
      expect(res.body.user.role).toBe('viewer');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 409 when room capacity of 3 is reached', async () => {
      vi.spyOn(RoomService, 'joinRoom').mockRejectedValue(new Error('ROOM_CAPACITY_EXCEEDED'));

      const res = await request(app)
        .post('/api/rooms/join')
        .send({ inviteToken: 'valid-token-12345678', displayName: 'Fourth Participant' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('ROOM_CAPACITY_EXCEEDED');
    });

    it('returns 403 when room is locked by host', async () => {
      vi.spyOn(RoomService, 'joinRoom').mockRejectedValue(new Error('ROOM_LOCKED'));

      const res = await request(app)
        .post('/api/rooms/join')
        .send({ inviteToken: 'valid-token-12345678', displayName: 'Charlie' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ROOM_LOCKED');
    });
  });

  describe('GET /api/rooms/session', () => {
    it('returns 401 when session cookie is absent', async () => {
      const res = await request(app).get('/api/rooms/session');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('returns session context when valid session cookie present', async () => {
      vi.spyOn(RoomService, 'verifySession').mockResolvedValue({
        participant_id: 'p-1',
        role: 'host',
        is_connected: true,
        user_id: 'u-1',
        display_name: 'Host Alice',
        is_guest: true,
        room_id: 'r-1',
        slug: 'slug-abc',
        title: 'Movie Night',
        is_locked: false,
        host_id: 'u-1',
        media_secret: 'sec-123',
        media_epoch: 1,
      });

      const res = await request(app)
        .get('/api/rooms/session')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=valid-session-token`]);

      expect(res.status).toBe(200);
      expect(res.body.display_name).toBe('Host Alice');
      expect(res.body.role).toBe('host');
    });
  });
});
