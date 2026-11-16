/**
 * API and Socket.IO connection resolver for Private Watch Party.
 * Connects directly to the live signalling and sync backend.
 */
const DEFAULT_SERVER_URL = 'https://watchparty-server-6a3v.onrender.com';

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_SERVER_URL;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function getSocketUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_SERVER_URL;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

const SESSION_STORAGE_KEY_PREFIX = 'watchparty_session_';

export function saveSessionToken(slug: string, token: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${SESSION_STORAGE_KEY_PREFIX}${slug}`, token);
      localStorage.setItem('watchparty_latest_session', token);
    } catch {}
  }
}

export function getSessionToken(slug?: string): string | null {
  if (typeof window !== 'undefined') {
    try {
      if (slug) {
        const token = localStorage.getItem(`${SESSION_STORAGE_KEY_PREFIX}${slug}`);
        if (token) return token;
      }
      return localStorage.getItem('watchparty_latest_session');
    } catch {}
  }
  return null;
}

export function getAuthHeaders(slug?: string): Record<string, string> {
  const token = getSessionToken(slug);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['x-session-token'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
