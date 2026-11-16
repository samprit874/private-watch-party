import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/room.service.js';
import { PlaybackService } from '../services/playback.service.js';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    roomId: string;
    displayName: string;
    role: 'host' | 'co-host' | 'viewer';
  };
}

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      let sessionToken: string | undefined;

      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map((c) => {
            const [k, ...v] = c.split('=');
            return [k, v.join('=')];
          })
        );
        sessionToken = cookies[SESSION_COOKIE_NAME];
      }

      // Also allow handshake auth token if cookies restricted
      if (!sessionToken && socket.handshake.auth?.token) {
        sessionToken = socket.handshake.auth.token;
      }

      if (!sessionToken) {
        return next(new Error('AUTH_REQUIRED'));
      }

      const session = await RoomService.verifySession(sessionToken);
      if (!session) {
        return next(new Error('INVALID_SESSION'));
      }

      socket.data = {
        userId: session.user_id,
        roomId: session.room_id,
        displayName: session.display_name,
        role: session.role,
      };

      next();
    } catch (err) {
      next(new Error('AUTH_ERROR'));
    }
  });

  io.on('connection', async (socketRaw) => {
    const socket = socketRaw as AuthenticatedSocket;
    const { roomId, userId, displayName, role } = socket.data;

    const roomChannel = `room:${roomId}`;
    await socket.join(roomChannel);

    console.log(`[Socket] User ${displayName} (${userId}) connected to ${roomChannel}`);

    // Notify room of presence update
    io.to(roomChannel).emit('PARTICIPANT_JOINED', {
      userId,
      displayName,
      role,
      socketId: socket.id,
      timestamp: Date.now(),
    });

    // Send initial authoritative playback state to connecting socket
    const currentState = await PlaybackService.getPlaybackState(roomId);
    socket.emit('SYNC_STATE', currentState);

    // 1. NTP Clock Synchronization Handshake
    socket.on('NTP_PING', (data: { clientTime: number }) => {
      socket.emit('NTP_PONG', {
        clientTime: data.clientTime,
        serverTime: Date.now(),
      });
    });

    // 2. Playback: PLAY
    socket.on('MEDIA_PLAY', async (data: { position: number }) => {
      // Host or co-host can trigger playback
      if (socket.data.role !== 'host' && socket.data.role !== 'co-host') {
        return socket.emit('ERROR', { code: 'FORBIDDEN', message: 'Viewer cannot control playback' });
      }

      const state = await PlaybackService.play(roomId, data.position, userId);
      io.to(roomChannel).emit('PLAYBACK_COMMAND', {
        action: 'PLAY',
        position: state.position,
        basePlaybackRate: state.basePlaybackRate,
        serverTimestamp: state.serverTimestamp,
        revision: state.revision,
      });
    });

    // 3. Playback: PAUSE
    socket.on('MEDIA_PAUSE', async (data: { position: number }) => {
      if (socket.data.role !== 'host' && socket.data.role !== 'co-host') {
        return socket.emit('ERROR', { code: 'FORBIDDEN', message: 'Viewer cannot control playback' });
      }

      const state = await PlaybackService.pause(roomId, data.position, userId);
      io.to(roomChannel).emit('PLAYBACK_COMMAND', {
        action: 'PAUSE',
        position: state.position,
        basePlaybackRate: state.basePlaybackRate,
        serverTimestamp: state.serverTimestamp,
        revision: state.revision,
      });
    });

    // 4. Playback: SEEK
    socket.on('MEDIA_SEEK', async (data: { targetPosition: number }) => {
      if (socket.data.role !== 'host' && socket.data.role !== 'co-host') {
        return socket.emit('ERROR', { code: 'FORBIDDEN', message: 'Viewer cannot control playback' });
      }

      const state = await PlaybackService.seek(roomId, data.targetPosition, userId);
      io.to(roomChannel).emit('PLAYBACK_COMMAND', {
        action: 'SEEK',
        position: state.position,
        basePlaybackRate: state.basePlaybackRate,
        serverTimestamp: state.serverTimestamp,
        revision: state.revision,
      });
    });

    // 5. Playback: SET_RATE
    socket.on('MEDIA_RATE', async (data: { baseRate: number; position: number }) => {
      if (socket.data.role !== 'host' && socket.data.role !== 'co-host') {
        return socket.emit('ERROR', { code: 'FORBIDDEN', message: 'Viewer cannot control playback' });
      }

      const state = await PlaybackService.setRate(roomId, data.baseRate, data.position, userId);
      io.to(roomChannel).emit('PLAYBACK_COMMAND', {
        action: 'SET_RATE',
        position: state.position,
        basePlaybackRate: state.basePlaybackRate,
        serverTimestamp: state.serverTimestamp,
        revision: state.revision,
      });
    });

    // 6. Request Full State Sync (e.g. after reconnection)
    socket.on('REQUEST_SYNC', async () => {
      const state = await PlaybackService.getPlaybackState(roomId);
      socket.emit('SYNC_STATE', state);
    });

    // 7. Viewer Buffering Telemetry
    socket.on('VIEWER_BUFFERING', (data: { isBuffering: boolean; position: number }) => {
      socket.to(roomChannel).emit('VIEWER_BUFFER_UPDATE', {
        userId,
        displayName,
        isBuffering: data.isBuffering,
        position: data.position,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User ${displayName} (${userId}) disconnected from ${roomChannel}`);
      io.to(roomChannel).emit('PARTICIPANT_LEFT', {
        userId,
        displayName,
        timestamp: Date.now(),
      });
    });
  });

  return io;
}
