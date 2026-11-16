'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl, getSessionToken } from '../lib/api';

export interface ParticipantInfo {
  id: string;
  displayName: string;
  role: 'host' | 'co-host' | 'viewer';
  socketId?: string;
  isConnected: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: number;
}

interface UseWebRTCScreenShareOptions {
  roomId?: string;
  slug?: string;
  isHost: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 4,
};

export function useWebRTCScreenShare({ roomId, slug, isHost }: UseWebRTCScreenShareOptions) {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRemoteSharing, setIsRemoteSharing] = useState(false);
  const [hasAudio, setHasAudio] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Periodic and on-demand REST participant sync fallback
  const refreshParticipants = useCallback(async () => {
    if (!slug) return;
    try {
      const serverUrl = getSocketUrl();
      const res = await fetch(`${serverUrl}/api/rooms/${slug}/participants`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.participants) && data.participants.length > 0) {
          setParticipants(data.participants);
        }
      }
    } catch {}
  }, [slug]);

  // Initial and on-demand REST chat message history fallback
  const fetchMessages = useCallback(async () => {
    if (!slug) return;
    try {
      const serverUrl = getSocketUrl();
      const res = await fetch(`${serverUrl}/api/rooms/${slug}/messages`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch {}
  }, [slug]);

  // Initialize Socket.IO connection for WebRTC signaling and presence
  useEffect(() => {
    if (!roomId) return;

    const serverUrl = getSocketUrl();
    const token = getSessionToken(slug) || getSessionToken();
    const socket = io(serverUrl, {
      withCredentials: true,
      auth: { token },
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 500,
      timeout: 10000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      refreshParticipants();
      fetchMessages();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Chat Message Events
    socket.on('MESSAGE_HISTORY', (history: ChatMessage[]) => {
      if (Array.isArray(history)) {
        setMessages(history);
      }
    });

    socket.on('NEW_MESSAGE', (msg: ChatMessage) => {
      if (msg && msg.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    });

    // 1. Participant Roster Updates
    socket.on('ROOM_PARTICIPANTS', (roster: any[]) => {
      setParticipants(
        roster.map((p) => ({
          id: p.id || p.userId,
          displayName: p.displayName || 'Guest',
          role: p.role || 'viewer',
          socketId: p.socketId,
          isConnected: true,
        }))
      );
    });

    socket.on('PARTICIPANT_JOINED', (p: any) => {
      const pId = p.id || p.userId;
      setParticipants((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === pId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            displayName: p.displayName || updated[existingIndex].displayName,
            role: p.role || updated[existingIndex].role,
            socketId: p.socketId,
            isConnected: true,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: pId,
            displayName: p.displayName || 'Guest',
            role: p.role || 'viewer',
            socketId: p.socketId,
            isConnected: true,
          },
        ];
      });

      refreshParticipants();

      // If host is actively sharing and a new viewer joins, initiate WebRTC offer to them
      if (isHost && localStreamRef.current && p.socketId) {
        initiateOfferToPeer(socket, p.socketId, localStreamRef.current);
      }
    });

    socket.on('PARTICIPANT_LEFT', (p: any) => {
      const pId = p.id || p.userId;
      if (p.socketId) {
        const pc = peerConnectionsRef.current.get(p.socketId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(p.socketId);
        }
      }
      setParticipants((prev) => prev.filter((item) => item.id !== pId));
      refreshParticipants();
    });

    // 2. Screen Share Session State
    socket.on('SCREEN_SHARE_STARTED', (data: { hostId: string; hostSocketId: string; hasAudio: boolean }) => {
      if (!isHost) {
        setIsRemoteSharing(true);
        setHasAudio(data.hasAudio);
      }
    });

    socket.on('SCREEN_SHARE_STOPPED', () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setRemoteStream(null);
      setIsRemoteSharing(false);
    });

    // 3. WebRTC Signaling Dispatcher
    socket.on('WEBRTC_SIGNAL', async (data: { senderSocketId: string; senderUserId: string; signal: any }) => {
      const { senderSocketId, signal } = data;
      if (!signal) return;

      try {
        if (signal.type === 'offer') {
          // Viewer handles incoming Offer from host
          let pc = peerConnectionsRef.current.get(senderSocketId);
          if (!pc) {
            pc = new RTCPeerConnection(RTC_CONFIG);
            peerConnectionsRef.current.set(senderSocketId, pc);

            pc.ontrack = (event) => {
              if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
                setIsRemoteSharing(true);
              }
            };

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                socket.emit('WEBRTC_SIGNAL', {
                  targetSocketId: senderSocketId,
                  signal: { type: 'candidate', candidate: event.candidate },
                });
              }
            };
          }

          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const answer = await pc.createAnswer();
          const boostedSdp = boostSdpBitrate(answer.sdp || '');
          const boostedAnswer = new RTCSessionDescription({ type: 'answer', sdp: boostedSdp });
          await pc.setLocalDescription(boostedAnswer);

          socket.emit('WEBRTC_SIGNAL', {
            targetSocketId: senderSocketId,
            signal: { type: 'answer', sdp: pc.localDescription?.sdp || answer.sdp },
          });
        } else if (signal.type === 'answer') {
          // Host handles Answer from viewer
          const pc = peerConnectionsRef.current.get(senderSocketId);
          if (pc && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          }
        } else if (signal.type === 'candidate') {
          // Both handle ICE candidate
          const pc = peerConnectionsRef.current.get(senderSocketId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch (err: any) {
        console.error('[WebRTC] Signaling error:', err);
      }
    });

    return () => {
      socket.disconnect();
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [roomId, slug, isHost, refreshParticipants]);

// Helper to boost WebRTC SDP bandwidth to 8 Mbps for pristine 1080p 60fps streaming
const boostSdpBitrate = (sdp: string, bitrateKbps: number = 8000): string => {
  const lines = sdp.split('\r\n');
  let inVideo = false;
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith('m=video')) {
      inVideo = true;
      result.push(line);
      result.push(`b=AS:${bitrateKbps}`);
      result.push(`b=TIAS:${bitrateKbps * 1000}`);
      continue;
    } else if (line.startsWith('m=')) {
      inVideo = false;
    }
    if (inVideo && (line.startsWith('b=AS:') || line.startsWith('b=TIAS:'))) {
      continue;
    }
    result.push(line);
  }
  return result.join('\r\n');
};

  // Helper: Host initiates WebRTC Offer to a peer
  const initiateOfferToPeer = async (socket: Socket, targetSocketId: string, stream: MediaStream) => {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetSocketId, pc);

      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 8000000; // 8 Mbps high-bitrate encoding
            params.encodings[0].maxFramerate = 60;
            params.encodings[0].scaleResolutionDownBy = 1.0;
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('WEBRTC_SIGNAL', {
            targetSocketId,
            signal: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      const offer = await pc.createOffer();
      const boostedSdp = boostSdpBitrate(offer.sdp || '');
      const boostedOffer = new RTCSessionDescription({ type: 'offer', sdp: boostedSdp });
      await pc.setLocalDescription(boostedOffer);

      socket.emit('WEBRTC_SIGNAL', {
        targetSocketId,
        signal: { type: 'offer', sdp: pc.localDescription?.sdp || offer.sdp },
      });
    } catch (err) {
      console.error('[WebRTC] Error creating offer to peer:', err);
    }
  };

  // Host: Start Screen Sharing
  const startScreenShare = useCallback(async () => {
    if (!isHost) return;

    try {
      setError(null);
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser environment');
      }

      // Enforce 1080p Full HD at up to 60 FPS
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsSharing(true);

      const hasAudioTrack = stream.getAudioTracks().length > 0;
      setHasAudio(hasAudioTrack);

      // Enforce motion smoothness hint so browser maintains full 60fps
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        if ('contentHint' in videoTrack) {
          (videoTrack as any).contentHint = 'motion';
        }
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      const socket = socketRef.current;
      if (socket) {
        socket.emit('SCREEN_SHARE_START', { hasAudio: hasAudioTrack });

        // Connect to all current participants
        participants.forEach((p) => {
          if (p.socketId && p.socketId !== socket.id) {
            initiateOfferToPeer(socket, p.socketId, stream);
          }
        });
      }
    } catch (err: any) {
      console.error('Error starting screen share:', err);
      setError(err.message || 'Screen capture cancelled or unavailable');
      setIsSharing(false);
      setLocalStream(null);
    }
  }, [isHost, participants]);

  // Host: Stop Screen Sharing
  const stopScreenShare = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setLocalStream(null);
    setIsSharing(false);

    socketRef.current?.emit('SCREEN_SHARE_STOP');
  }, []);

  // Room Chat: Send Message
  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current) return;
    socketRef.current.emit('SEND_MESSAGE', { text: trimmed });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isSharing,
    isRemoteSharing,
    hasAudio,
    localStream,
    remoteStream,
    participants,
    messages,
    sendMessage,
    error,
    startScreenShare,
    stopScreenShare,
  };
}
