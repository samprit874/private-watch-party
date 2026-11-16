import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import * as ssrfModule from '../../src/services/ssrfValidator.js';

describe('Media Routes - Direct URL Validation', () => {
  it('returns 200 for valid public video URLs', async () => {
    vi.spyOn(ssrfModule, 'validateMediaUrl').mockResolvedValueOnce({
      isValid: true,
      resolvedIp: '1.2.3.4',
    });

    const res = await request(app)
      .post('/api/media/validate-url')
      .send({ url: 'https://example.com/movie.mp4' });

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.url).toBe('https://example.com/movie.mp4');
  });

  it('returns 400 for internal/private IP video URLs', async () => {
    vi.spyOn(ssrfModule, 'validateMediaUrl').mockResolvedValueOnce({
      isValid: false,
      error: 'BLOCKED_INTERNAL_IP',
    });

    const res = await request(app)
      .post('/api/media/validate-url')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });

    expect(res.status).toBe(400);
    expect(res.body.isValid).toBe(false);
    expect(res.body.error).toBe('BLOCKED_INTERNAL_IP');
  });
});
