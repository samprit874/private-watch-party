import crypto from 'crypto';

export interface HlsTokenPayload {
  uploadId: string;
  roomId: string;
  userId: string;
  exp: number;
  epoch: number;
}

export class MediaAuthService {
  /**
   * Mints an HMAC token for HLS segment access.
   */
  static mintToken(
    uploadId: string,
    roomId: string,
    userId: string,
    epoch: number,
    secret: string,
    ttlMinutes: number = 20
  ): string {
    const exp = Date.now() + ttlMinutes * 60 * 1000;
    const payload: HlsTokenPayload = {
      uploadId,
      roomId,
      userId,
      exp,
      epoch,
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifies token signature, time expiration, and media epoch.
   */
  static verifyToken(
    token: string,
    secret: string,
    currentEpoch: number
  ): { isValid: boolean; payload?: HlsTokenPayload; error?: string } {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { isValid: false, error: 'MALFORMED_TOKEN' };
    }

    const [payloadB64, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { isValid: false, error: 'INVALID_SIGNATURE' };
    }

    try {
      const payload: HlsTokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

      if (Date.now() > payload.exp) {
        return { isValid: false, error: 'TOKEN_EXPIRED' };
      }

      // Epoch revocation check
      if (payload.epoch < currentEpoch) {
        return { isValid: false, error: 'ACCESS_REVOKED' };
      }

      return { isValid: true, payload };
    } catch {
      return { isValid: false, error: 'DECODE_ERROR' };
    }
  }
}
