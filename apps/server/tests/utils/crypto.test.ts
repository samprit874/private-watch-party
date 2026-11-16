import { describe, it, expect } from 'vitest';
import { generateRandomToken, hashToken, generateSlug, signPayload, verifySignedPayload } from '../../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  it('generates a 64-character hex token with 32 bytes entropy', () => {
    const token = generateRandomToken(32);
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates unique tokens on subsequent calls', () => {
    const token1 = generateRandomToken();
    const token2 = generateRandomToken();
    expect(token1).not.toBe(token2);
  });

  it('hashes a token deterministically with SHA-256', () => {
    const raw = 'test-token-secret-123';
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('generates a URL-safe slug', () => {
    const slug = generateSlug(10);
    expect(slug).toHaveLength(10);
    expect(/^[A-Za-z0-9_-]+$/.test(slug)).toBe(true);
  });

  it('signs and verifies payload correctly', () => {
    const secret = 'super-secret-key-32-bytes-long!';
    const payload = { userId: '123', roomId: '456', exp: Date.now() + 60000 };
    const token = signPayload(payload, secret);

    const verified = verifySignedPayload<typeof payload>(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('123');
    expect(verified?.roomId).toBe('456');

    // Tampered token must fail
    const tampered = token.slice(0, -4) + 'abcd';
    expect(verifySignedPayload(tampered, secret)).toBeNull();

    // Wrong secret must fail
    expect(verifySignedPayload(token, 'wrong-secret')).toBeNull();
  });
});
