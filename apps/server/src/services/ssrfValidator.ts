import dns from 'dns/promises';
import http from 'http';
import { URL } from 'url';

const BLOCKED_IP_PREFIXES = [
  '0.',        // 0.0.0.0/8
  '10.',       // 10.0.0.0/8 Private
  '127.',      // 127.0.0.0/8 Loopback
  '169.254.',  // 169.254.0.0/16 Link-Local / Cloud Metadata
  '192.168.',  // 192.168.0.0/16 Private
];

export function isPrivateIp(ip: string): boolean {
  if (ip === 'localhost' || ip === '::1' || ip === '0.0.0.0') {
    return true;
  }

  for (const prefix of BLOCKED_IP_PREFIXES) {
    if (ip.startsWith(prefix)) {
      return true;
    }
  }

  // 172.16.0.0 - 172.31.255.255
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }

  // IPv6 ULA (fc00::/7) or Link-Local (fe80::/10)
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) {
    return true;
  }

  return false;
}

export interface MediaUrlValidationResult {
  isValid: boolean;
  resolvedIp?: string;
  error?: string;
}

/**
 * Validates a direct video URL against SSRF attacks and internal network probing.
 */
export async function validateMediaUrl(targetUrl: string): Promise<MediaUrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { isValid: false, error: 'MALFORMED_URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'UNSUPPORTED_PROTOCOL' };
  }

  try {
    // Resolve host to IP
    const lookup = await dns.lookup(parsed.hostname);
    const ip = lookup.address;

    if (isPrivateIp(ip)) {
      return { isValid: false, resolvedIp: ip, error: 'BLOCKED_INTERNAL_IP' };
    }

    return { isValid: true, resolvedIp: ip };
  } catch (err: any) {
    return { isValid: false, error: 'DNS_RESOLUTION_FAILED' };
  }
}
