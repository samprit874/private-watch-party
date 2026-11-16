import { describe, it, expect, vi } from 'vitest';
import { isPrivateIp, validateMediaUrl } from '../../src/services/ssrfValidator.js';
import dns from 'dns/promises';

describe('Anti-SSRF URL Validator', () => {
  it('detects private IPv4 and loopback addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('192.168.1.100')).toBe(true);
    expect(isPrivateIp('172.20.0.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS/Cloud metadata
    expect(isPrivateIp('::1')).toBe(true);

    // Public IPs must pass
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('104.21.5.10')).toBe(false);
  });

  it('rejects malformed and non-http protocols', async () => {
    expect((await validateMediaUrl('file:///etc/passwd')).isValid).toBe(false);
    expect((await validateMediaUrl('ftp://example.com/video.mp4')).isValid).toBe(false);
    expect((await validateMediaUrl('not-a-valid-url')).isValid).toBe(false);
  });

  it('blocks URLs resolving to private subnets', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '169.254.169.254', family: 4 });
    const res = await validateMediaUrl('http://cloud-metadata.internal/video.mp4');
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('BLOCKED_INTERNAL_IP');
  });

  it('allows public URLs', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValueOnce({ address: '104.21.5.10', family: 4 });
    const res = await validateMediaUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    expect(res.isValid).toBe(true);
    expect(res.resolvedIp).toBe('104.21.5.10');
  });
});
