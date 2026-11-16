import { AccessToken } from 'livekit-server-sdk';

export interface GenerateLiveKitTokenOptions {
  roomId: string;
  userId: string;
  displayName: string;
  isHost: boolean;
}

export class LiveKitService {
  private static apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  private static apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
  public static serverUrl = process.env.LIVEKIT_URL || 'ws://localhost:7880';

  /**
   * Mints an authenticated LiveKit WebRTC access token.
   * Only the host can publish video/audio tracks; viewers can subscribe.
   */
  static async generateToken(options: GenerateLiveKitTokenOptions): Promise<string> {
    const { roomId, userId, displayName, isHost } = options;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName,
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: isHost,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }
}
