import { Request, Response } from 'express';
import { LiveKitService } from '../services/livekit.service.js';
import { RoomService } from '../services/room.service.js';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

export class LiveKitController {
  static async getToken(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      const sessionToken = req.cookies?.[SESSION_COOKIE_NAME];

      if (!sessionToken) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      const session = await RoomService.verifySession(sessionToken);
      if (!session || session.room_id !== roomId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a member of this room' });
      }

      const isHost = session.role === 'host' || session.role === 'co-host';

      const token = await LiveKitService.generateToken({
        roomId: session.room_id,
        userId: session.user_id,
        displayName: session.display_name,
        isHost,
      });

      return res.json({
        token,
        serverUrl: LiveKitService.serverUrl,
        canPublish: isHost,
      });
    } catch (err) {
      console.error('Error generating LiveKit token:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
