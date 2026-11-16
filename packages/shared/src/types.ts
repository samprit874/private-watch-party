export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isGuest: boolean;
  email?: string | null;
  createdAt: Date | string;
}

export interface Room {
  id: string;
  slug: string;
  inviteTokenHash: string;
  hostId: string;
  title: string;
  isLocked: boolean;
  maxParticipants: number;
  currentMediaId?: string | null;
  mediaSecret: string;
  mediaEpoch: number;
  isSuspended: boolean;
  expiresAt: Date | string;
  createdAt: Date | string;
}

export type ParticipantRole = 'host' | 'co-host' | 'viewer';

export interface Participant {
  id: string;
  roomId: string;
  userId: string;
  sessionTokenHash: string;
  socketId?: string | null;
  role: ParticipantRole;
  isConnected: boolean;
  joinedAt: Date | string;
  lastSeenAt: Date | string;
  disconnectedAt?: Date | string | null;
}

export type MediaEngineType = 'screen_share' | 'direct_url' | 'upload';

export interface MediaSource {
  id: string;
  roomId: string;
  engineType: MediaEngineType;
  title: string;
  sourceUrl?: string | null;
  duration: number;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: Date | string;
}

export type PlaybackStatus = 'playing' | 'paused';

export interface PlaybackState {
  roomId: string;
  mediaId: string | null;
  status: PlaybackStatus;
  position: number;
  basePlaybackRate: number;
  serverTimestamp: number;
  revision: number;
  updatedBy?: string | null;
}
