import { Request } from 'express';
import { SESSION_COOKIE_NAME } from '@watchparty/shared';

export function extractSessionToken(req: Request): string | undefined {
  const headerToken = (req.headers['x-session-token'] as string) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : undefined);
  return headerToken || req.cookies?.[SESSION_COOKIE_NAME];
}
