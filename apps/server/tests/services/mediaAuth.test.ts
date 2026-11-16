import { describe, it, expect } from 'vitest';
import { MediaAuthService } from '../../src/services/mediaAuth.service.js';

describe('Media Authorization & Epoch Revocation Service', () => {
  const secret = 'room-secret-key-32-bytes-secure!';
  const roomId = 'room-abc';
  const uploadId = 'upload-123';
  const userId = 'user-456';

  it('mints and verifies valid HLS token', () => {
    const token = MediaAuthService.mintToken(uploadId, roomId, userId, 1, secret, 15);
    const result = MediaAuthService.verifyToken(token, secret, 1);

    expect(result.isValid).toBe(true);
    expect(result.payload?.uploadId).toBe(uploadId);
    expect(result.payload?.roomId).toBe(roomId);
    expect(result.payload?.epoch).toBe(1);
  });

  it('rejects token when room epoch has incremented (revocation check)', () => {
    // User was issued a token with epoch 1
    const token = MediaAuthService.mintToken(uploadId, roomId, userId, 1, secret, 15);

    // Host evicts a user, incrementing active room epoch to 2
    const result = MediaAuthService.verifyToken(token, secret, 2);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('ACCESS_REVOKED');
  });

  it('rejects tampered or forged tokens', () => {
    const token = MediaAuthService.mintToken(uploadId, roomId, userId, 1, secret, 15);
    const tampered = token.slice(0, -6) + 'abcdef';

    expect(MediaAuthService.verifyToken(tampered, secret, 1).isValid).toBe(false);
    expect(MediaAuthService.verifyToken(token, 'wrong-secret', 1).isValid).toBe(false);
  });

  it('rejects expired tokens', () => {
    // Mint token with negative TTL
    const token = MediaAuthService.mintToken(uploadId, roomId, userId, 1, secret, -5);
    const result = MediaAuthService.verifyToken(token, secret, 1);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('TOKEN_EXPIRED');
  });
});
