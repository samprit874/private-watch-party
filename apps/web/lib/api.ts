/**
 * Resolves the API base URL.
 * In browser: returns '' so requests are same-origin and proxied by Next.js.
 * In server/SSR: returns the full backend origin.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function getSocketUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}
