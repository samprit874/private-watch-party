import { pool } from '../db/pool.js';
import { generateRandomToken, hashToken, generateSlug } from '../utils/crypto.js';
import { MAX_ROOM_PARTICIPANTS } from '@watchparty/shared';

export interface CreateRoomInput {
  displayName: string;
  title?: string;
}

export interface CreateRoomResult {
  roomId: string;
  slug: string;
  inviteToken: string;
  sessionToken: string;
  hostUser: {
    id: string;
    displayName: string;
  };
}

export interface JoinRoomInput {
  inviteToken: string;
  displayName: string;
}

export interface JoinRoomResult {
  roomId: string;
  slug: string;
  sessionToken: string;
  user: {
    id: string;
    displayName: string;
    role: 'viewer' | 'host' | 'co-host';
  };
}

export interface RoomDetails {
  id: string;
  slug: string;
  title: string;
  isLocked: boolean;
  maxParticipants: number;
  activeParticipantsCount: number;
  isFull: boolean;
  expiresAt: Date;
}

export class RoomService {
  /**
   * Atomically creates a guest host user, a room, a host participant, and initial playback state.
   */
  static async createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create Guest Host User
      const userRes = await client.query(
        `INSERT INTO users (display_name, is_guest) VALUES ($1, TRUE) RETURNING id, display_name`,
        [input.displayName.trim()]
      );
      const hostUser = userRes.rows[0];

      // 2. Generate Secrets
      const slug = generateSlug(10);
      const inviteToken = generateRandomToken(32);
      const inviteTokenHash = hashToken(inviteToken);
      const sessionToken = generateRandomToken(32);
      const sessionTokenHash = hashToken(sessionToken);

      // 3. Create Room
      const roomRes = await client.query(
        `INSERT INTO rooms (slug, invite_token_hash, host_id, title)
         VALUES ($1, $2, $3, $4)
         RETURNING id, slug, title`,
        [slug, inviteTokenHash, hostUser.id, input.title?.trim() || 'Private Watch Party']
      );
      const room = roomRes.rows[0];

      // 4. Create Host Participant Record
      await client.query(
        `INSERT INTO participants (room_id, user_id, session_token_hash, role, is_connected)
         VALUES ($1, $2, $3, 'host', TRUE)`,
        [room.id, hostUser.id, sessionTokenHash]
      );

      // 5. Initialize Authoritative Playback Session
      await client.query(
        `INSERT INTO playback_sessions (room_id, status, position, base_playback_rate, server_timestamp, revision, updated_by)
         VALUES ($1, 'paused', 0.0, 1.0, $2, 1, $3)`,
        [room.id, Date.now(), hostUser.id]
      );

      await client.query('COMMIT');

      return {
        roomId: room.id,
        slug: room.slug,
        inviteToken,
        sessionToken,
        hostUser: {
          id: hostUser.id,
          displayName: hostUser.display_name,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validates an invite token and returns room status (open/locked/full).
   */
  static async getRoomByInviteToken(inviteToken: string): Promise<RoomDetails | null> {
    const inviteTokenHash = hashToken(inviteToken);

    const roomRes = await pool.query(
      `SELECT r.id, r.slug, r.title, r.is_locked, r.max_participants, r.expires_at,
              COUNT(p.id) FILTER (WHERE p.is_connected = TRUE) AS active_count
       FROM rooms r
       LEFT JOIN participants p ON p.room_id = r.id
       WHERE r.invite_token_hash = $1
         AND r.is_suspended = FALSE
         AND r.expires_at > NOW()
       GROUP BY r.id`,
      [inviteTokenHash]
    );

    if (roomRes.rows.length === 0) {
      return null;
    }

    const row = roomRes.rows[0];
    const activeParticipantsCount = parseInt(row.active_count || '0', 10);

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      isLocked: row.is_locked,
      maxParticipants: row.max_participants,
      activeParticipantsCount,
      isFull: activeParticipantsCount >= row.max_participants,
      expiresAt: row.expires_at,
    };
  }

  /**
   * Concurrency-safe atomic participant join. Enforces 3-person ceiling.
   */
  static async joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const inviteTokenHash = hashToken(input.inviteToken);

      // 1. Lock room row to serialize join attempts
      const roomRes = await client.query(
        `SELECT id, slug, is_locked, expires_at, max_participants
         FROM rooms
         WHERE invite_token_hash = $1
         FOR UPDATE`,
        [inviteTokenHash]
      );

      if (roomRes.rows.length === 0) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const room = roomRes.rows[0];

      if (room.is_locked) {
        throw new Error('ROOM_LOCKED');
      }

      if (new Date(room.expires_at) < new Date()) {
        throw new Error('ROOM_EXPIRED');
      }

      // 2. Count active participants
      const countRes = await client.query(
        `SELECT COUNT(*) AS active_count
         FROM participants
         WHERE room_id = $1 AND is_connected = TRUE`,
        [room.id]
      );

      const activeCount = parseInt(countRes.rows[0].active_count, 10);
      if (activeCount >= room.max_participants) {
        throw new Error('ROOM_CAPACITY_EXCEEDED');
      }

      // 3. Create Guest User
      const userRes = await client.query(
        `INSERT INTO users (display_name, is_guest) VALUES ($1, TRUE) RETURNING id, display_name`,
        [input.displayName.trim()]
      );
      const user = userRes.rows[0];

      // 4. Create Session Token & Participant
      const sessionToken = generateRandomToken(32);
      const sessionTokenHash = hashToken(sessionToken);

      await client.query(
        `INSERT INTO participants (room_id, user_id, session_token_hash, role, is_connected)
         VALUES ($1, $2, $3, 'viewer', TRUE)`,
        [room.id, user.id, sessionTokenHash]
      );

      await client.query('COMMIT');

      return {
        roomId: room.id,
        slug: room.slug,
        sessionToken,
        user: {
          id: user.id,
          displayName: user.display_name,
          role: 'viewer',
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validates a session cookie token and returns participant & room context.
   */
  static async verifySession(sessionToken: string) {
    const sessionTokenHash = hashToken(sessionToken);

    const res = await pool.query(
      `SELECT p.id AS participant_id, p.role, p.is_connected,
              u.id AS user_id, u.display_name, u.is_guest,
              r.id AS room_id, r.slug, r.title, r.is_locked, r.host_id, r.media_secret, r.media_epoch
       FROM participants p
       JOIN users u ON u.id = p.user_id
       JOIN rooms r ON r.id = p.room_id
       WHERE p.session_token_hash = $1`,
      [sessionTokenHash]
    );

    if (res.rows.length === 0) {
      return null;
    }

    return res.rows[0];
  }
}
