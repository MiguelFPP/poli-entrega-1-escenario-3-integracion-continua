import type { Request } from 'express';

/** Metadatos de la petición que se guardan junto al refresh token. */
export type SessionContext = {
  userAgent: string | null;
  ip: string | null;
};

const MAX_USER_AGENT_LENGTH = 255;

export function sessionContextFrom(request: Request): SessionContext {
  const header = request.headers['user-agent'];
  const userAgent =
    typeof header === 'string' && header.length > 0
      ? header.slice(0, MAX_USER_AGENT_LENGTH)
      : null;

  return { userAgent, ip: request.ip ?? null };
}
