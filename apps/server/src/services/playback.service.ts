import { PlaybackState, PlaybackStatus } from '@watchparty/shared';
import { pool } from '../db/pool.js';

export class PlaybackService {
  private static states = new Map<string, PlaybackState>();

  /**
   * Initializes or loads room playback state from PostgreSQL.
   */
  static async getPlaybackState(roomId: string): Promise<PlaybackState> {
    const cached = this.states.get(roomId);
    if (cached) {
      return cached;
    }

    const res = await pool.query(
      `SELECT room_id, media_id, status, position, base_playback_rate, server_timestamp, revision, updated_by
       FROM playback_sessions
       WHERE room_id = $1`,
      [roomId]
    );

    if (res.rows.length === 0) {
      const defaultState: PlaybackState = {
        roomId,
        mediaId: null,
        status: 'paused',
        position: 0.0,
        basePlaybackRate: 1.0,
        serverTimestamp: Date.now(),
        revision: 1,
        updatedBy: null,
      };
      this.states.set(roomId, defaultState);
      return defaultState;
    }

    const row = res.rows[0];
    const state: PlaybackState = {
      roomId: row.room_id,
      mediaId: row.media_id,
      status: row.status as PlaybackStatus,
      position: parseFloat(row.position),
      basePlaybackRate: parseFloat(row.base_playback_rate),
      serverTimestamp: parseInt(row.server_timestamp, 10),
      revision: parseInt(row.revision, 10),
      updatedBy: row.updated_by,
    };

    this.states.set(roomId, state);
    return state;
  }

  /**
   * Updates state on PLAY event.
   */
  static async play(roomId: string, position: number, userId: string): Promise<PlaybackState> {
    const current = await this.getPlaybackState(roomId);
    const updated: PlaybackState = {
      ...current,
      status: 'playing',
      position,
      serverTimestamp: Date.now(),
      revision: current.revision + 1,
      updatedBy: userId,
    };

    this.states.set(roomId, updated);
    this.persist(updated);
    return updated;
  }

  /**
   * Updates state on PAUSE event.
   */
  static async pause(roomId: string, position: number, userId: string): Promise<PlaybackState> {
    const current = await this.getPlaybackState(roomId);
    const updated: PlaybackState = {
      ...current,
      status: 'paused',
      position,
      serverTimestamp: Date.now(),
      revision: current.revision + 1,
      updatedBy: userId,
    };

    this.states.set(roomId, updated);
    this.persist(updated);
    return updated;
  }

  /**
   * Updates state on SEEK event.
   */
  static async seek(roomId: string, targetPosition: number, userId: string): Promise<PlaybackState> {
    const current = await this.getPlaybackState(roomId);
    const updated: PlaybackState = {
      ...current,
      position: targetPosition,
      serverTimestamp: Date.now(),
      revision: current.revision + 1,
      updatedBy: userId,
    };

    this.states.set(roomId, updated);
    this.persist(updated);
    return updated;
  }

  /**
   * Updates state on RATE_CHANGE event.
   */
  static async setRate(roomId: string, baseRate: number, currentPosition: number, userId: string): Promise<PlaybackState> {
    const current = await this.getPlaybackState(roomId);
    const updated: PlaybackState = {
      ...current,
      position: currentPosition,
      basePlaybackRate: baseRate,
      serverTimestamp: Date.now(),
      revision: current.revision + 1,
      updatedBy: userId,
    };

    this.states.set(roomId, updated);
    this.persist(updated);
    return updated;
  }

  /**
   * Asynchronously persists playback state to PostgreSQL.
   */
  private static async persist(state: PlaybackState) {
    try {
      await pool.query(
        `INSERT INTO playback_sessions (room_id, media_id, status, position, base_playback_rate, server_timestamp, revision, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (room_id)
         DO UPDATE SET
           media_id = EXCLUDED.media_id,
           status = EXCLUDED.status,
           position = EXCLUDED.position,
           base_playback_rate = EXCLUDED.base_playback_rate,
           server_timestamp = EXCLUDED.server_timestamp,
           revision = EXCLUDED.revision,
           updated_by = EXCLUDED.updated_by`,
        [
          state.roomId,
          state.mediaId,
          state.status,
          state.position,
          state.basePlaybackRate,
          state.serverTimestamp,
          state.revision,
          state.updatedBy,
        ]
      );
    } catch (err) {
      console.error(`Failed to persist playback session for room ${state.roomId}:`, err);
    }
  }
}
