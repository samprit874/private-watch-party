'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Room, 
  RoomEvent, 
  Track, 
  RemoteTrack, 
  RemoteTrackPublication, 
  RemoteParticipant,
  LocalTrackPublication
} from 'livekit-client';
import { getApiBaseUrl, getAuthHeaders } from '../lib/api';

interface UseLiveKitRoomOptions {
  roomId?: string;
  isHost: boolean;
  onScreenShareStart?: (hasAudio: boolean) => void;
  onScreenShareStop?: () => void;
}

export function useLiveKitRoom({
  roomId,
  isHost,
  onScreenShareStart,
  onScreenShareStop,
}: UseLiveKitRoomOptions) {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasAudio, setHasAudio] = useState(true);
  const [screenTrack, setScreenTrack] = useState<RemoteTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<RemoteTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Connect to LiveKit Room
  useEffect(() => {
    if (!roomId) return;

    let isMounted = true;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const connectToLiveKit = async () => {
      try {
        const serverUrl = getApiBaseUrl();
        const headers = getAuthHeaders();
        const res = await fetch(`${serverUrl}/api/rooms/${roomId}/livekit-token`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to acquire LiveKit token');
        }

        const data = await res.json();
        if (!isMounted) return;

        // Connect room
        await room.connect(data.serverUrl, data.token);
        setIsConnected(true);

        // Listen for remote tracks
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
            if (publication.source === Track.Source.ScreenShare) {
              setScreenTrack(track);
            } else if (publication.source === Track.Source.ScreenShareAudio) {
              setAudioTrack(track);
              setHasAudio(true);
            }
          }
        );

        room.on(
          RoomEvent.TrackUnsubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication) => {
            if (publication.source === Track.Source.ScreenShare) {
              setScreenTrack(null);
            } else if (publication.source === Track.Source.ScreenShareAudio) {
              setAudioTrack(null);
              setHasAudio(false);
            }
          }
        );

        room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
          if (pub.source === Track.Source.ScreenShare) {
            setIsSharing(true);
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
          if (pub.source === Track.Source.ScreenShare) {
            setIsSharing(false);
          }
        });
      } catch (err: any) {
        if (isMounted) {
          console.warn('LiveKit connection skipped or failed:', err.message);
          setError(err.message);
        }
      }
    };

    connectToLiveKit();

    return () => {
      isMounted = false;
      room.disconnect();
    };
  }, [roomId]);

  // Host: Start Screen Sharing
  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !isHost) return;

    try {
      setError(null);
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true,
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 30,
        },
      });

      // Check if audio track exists
      const pubs = Array.from(room.localParticipant.trackPublications.values());
      const hasSystemAudio = pubs.some((p) => p.source === Track.Source.ScreenShareAudio);
      setHasAudio(hasSystemAudio);
      setIsSharing(true);
      onScreenShareStart?.(hasSystemAudio);
    } catch (err: any) {
      console.error('Error starting screen share:', err);
      setError(err.message || 'Screen capture was cancelled or is unsupported');
      setIsSharing(false);
    }
  }, [isHost, onScreenShareStart]);

  // Host: Stop Screen Sharing
  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !isHost) return;

    try {
      await room.localParticipant.setScreenShareEnabled(false);
      setIsSharing(false);
      onScreenShareStop?.();
    } catch (err: any) {
      console.error('Error stopping screen share:', err);
    }
  }, [isHost, onScreenShareStop]);

  return {
    isConnected,
    isSharing,
    hasAudio,
    screenTrack,
    audioTrack,
    error,
    startScreenShare,
    stopScreenShare,
  };
}

