'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  calculateNtpOffset, 
  computeExpectedPosition, 
  computeDriftCorrection, 
  PlaybackState,
  DriftCorrection
} from '@watchparty/shared';
import { getSocketUrl, getSessionToken } from '../lib/api';

interface UseSocketSyncOptions {
  roomId?: string;
  isHost: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onMediaChange?: (url: string, title?: string) => void;
  onParticipantsUpdate?: (participants: Array<{ id: string; displayName: string; role: string; socketId: string }>) => void;
  onScreenShareStart?: (data: { hostId: string; hostSocketId: string; hasAudio: boolean }) => void;
  onScreenShareStop?: () => void;
}

export function useSocketSync({
  roomId,
  isHost,
  videoRef,
  onMediaChange,
  onParticipantsUpdate,
  onScreenShareStart,
  onScreenShareStop,
}: UseSocketSyncOptions) {
  const socketRef = useRef<Socket | null>(null);
  const clockOffsetRef = useRef<number>(0);
  const lastRevisionRef = useRef<number>(0);
  const lastRateChangeTimeRef = useRef<number>(0);
  const anchorStateRef = useRef<PlaybackState | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [driftInfo, setDriftInfo] = useState<DriftCorrection>({
    drift: 0,
    effectiveRate: 1.0,
    action: 'deadband',
  });
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);

  // 1. Initialize Socket.IO connection
  useEffect(() => {
    const serverUrl = getSocketUrl();
    const token = getSessionToken();
    const socket = io(serverUrl, {
      withCredentials: true,
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Run initial NTP Ping
      socket.emit('NTP_PING', { clientTime: Date.now() });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle NTP Pong
    socket.on('NTP_PONG', (data: { clientTime: number; serverTime: number }) => {
      const now = Date.now();
      const { offset } = calculateNtpOffset(data.clientTime, data.serverTime, now);
      clockOffsetRef.current = offset;
    });

    // Handle Room Participants roster
    socket.on('ROOM_PARTICIPANTS', (participants: any[]) => {
      onParticipantsUpdate?.(participants);
    });

    socket.on('PARTICIPANT_JOINED', (_data: any) => {
      // Re-fetch or update when participant joins
    });

    socket.on('PARTICIPANT_LEFT', (_data: any) => {
      // Update when participant leaves
    });

    // Handle Screen Sharing State Announcements
    socket.on('SCREEN_SHARE_STARTED', (data: any) => {
      onScreenShareStart?.(data);
    });

    socket.on('SCREEN_SHARE_STOPPED', () => {
      onScreenShareStop?.();
    });

    // Handle Room Media Change (Engine B & C)
    socket.on('MEDIA_CHANGED', (data: { url: string; title?: string }) => {
      onMediaChange?.(data.url, data.title);
    });

    // Handle initial state sync
    socket.on('SYNC_STATE', (state: PlaybackState) => {
      anchorStateRef.current = state;
      lastRevisionRef.current = state.revision;
      setPlaybackState(state);

      if (videoRef.current) {
        const expected = computeExpectedPosition(state, Date.now(), clockOffsetRef.current);
        videoRef.current.currentTime = expected;
        if (state.status === 'playing') {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      }
    });

    // Handle incoming playback commands
    socket.on('PLAYBACK_COMMAND', (cmd: {
      action: 'PLAY' | 'PAUSE' | 'SEEK' | 'SET_RATE';
      position: number;
      basePlaybackRate: number;
      serverTimestamp: number;
      revision: number;
    }) => {
      // Discard stale out-of-order revisions
      if (cmd.revision <= lastRevisionRef.current) {
        return;
      }
      lastRevisionRef.current = cmd.revision;

      const video = videoRef.current;
      if (!video) return;

      if (cmd.action === 'PLAY') {
        anchorStateRef.current = {
          roomId: roomId || '',
          mediaId: null,
          status: 'playing',
          position: cmd.position,
          basePlaybackRate: cmd.basePlaybackRate,
          serverTimestamp: cmd.serverTimestamp,
          revision: cmd.revision,
        };
        setPlaybackState(anchorStateRef.current);
        video.play().catch(() => {});
      } else if (cmd.action === 'PAUSE') {
        anchorStateRef.current = {
          roomId: roomId || '',
          mediaId: null,
          status: 'paused',
          position: cmd.position,
          basePlaybackRate: cmd.basePlaybackRate,
          serverTimestamp: cmd.serverTimestamp,
          revision: cmd.revision,
        };
        setPlaybackState(anchorStateRef.current);
        video.pause();
        video.currentTime = cmd.position;
      } else if (cmd.action === 'SEEK') {
        if (anchorStateRef.current) {
          anchorStateRef.current.position = cmd.position;
          anchorStateRef.current.serverTimestamp = cmd.serverTimestamp;
          anchorStateRef.current.revision = cmd.revision;
        }
        video.currentTime = cmd.position;
      } else if (cmd.action === 'SET_RATE') {
        if (anchorStateRef.current) {
          anchorStateRef.current.basePlaybackRate = cmd.basePlaybackRate;
          anchorStateRef.current.position = cmd.position;
          anchorStateRef.current.serverTimestamp = cmd.serverTimestamp;
          anchorStateRef.current.revision = cmd.revision;
        }
        video.playbackRate = cmd.basePlaybackRate;
      }
    });

    // Recurring NTP calibration every 15s
    const ntpInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('NTP_PING', { clientTime: Date.now() });
      }
    }, 15000);

    return () => {
      clearInterval(ntpInterval);
      socket.disconnect();
    };
  }, [roomId, videoRef]);

  // 2. Playback Synchronization & Drift Correction Loop (Runs every 1000ms for viewers)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const video = videoRef.current;
      const anchor = anchorStateRef.current;
      if (!video || !anchor) return;

      const expected = computeExpectedPosition(anchor, Date.now(), clockOffsetRef.current);
      const current = video.currentTime;
      const baseRate = anchor.basePlaybackRate || 1.0;

      const correction = computeDriftCorrection(current, expected, baseRate);
      setDriftInfo(correction);

      // Only viewers apply automatic sync slewing; host is the authoritative master
      if (!isHost) {
        if (correction.action === 'hard_seek') {
          video.currentTime = expected;
          video.playbackRate = baseRate;
        } else if (correction.action === 'deadband') {
          if (video.playbackRate !== baseRate) {
            video.playbackRate = baseRate;
          }
        } else {
          // Apply slew with 4-second dwell hysteresis to prevent pitch flutter
          const now = Date.now();
          if (now - lastRateChangeTimeRef.current >= 4000) {
            video.playbackRate = correction.effectiveRate;
            lastRateChangeTimeRef.current = now;
          }
        }
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [isHost, videoRef]);

  // Host playback dispatchers
  const sendPlay = useCallback((position: number) => {
    socketRef.current?.emit('MEDIA_PLAY', { position });
  }, []);

  const sendPause = useCallback((position: number) => {
    socketRef.current?.emit('MEDIA_PAUSE', { position });
  }, []);

  const sendSeek = useCallback((targetPosition: number) => {
    socketRef.current?.emit('MEDIA_SEEK', { targetPosition });
  }, []);

  const sendRate = useCallback((baseRate: number, position: number) => {
    socketRef.current?.emit('MEDIA_RATE', { baseRate, position });
  }, []);

  const sendMediaChange = useCallback((url: string, title?: string) => {
    socketRef.current?.emit('MEDIA_CHANGE', { url, title });
  }, []);

  const sendScreenShareStart = useCallback((hasAudio: boolean) => {
    socketRef.current?.emit('SCREEN_SHARE_START', { hasAudio });
  }, []);

  const sendScreenShareStop = useCallback(() => {
    socketRef.current?.emit('SCREEN_SHARE_STOP');
  }, []);

  const sendWebRTCSignal = useCallback((targetSocketId: string | undefined, signal: any) => {
    socketRef.current?.emit('WEBRTC_SIGNAL', { targetSocketId, signal });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    driftInfo,
    playbackState,
    sendPlay,
    sendPause,
    sendSeek,
    sendRate,
    sendMediaChange,
    sendScreenShareStart,
    sendScreenShareStop,
    sendWebRTCSignal,
  };
}
