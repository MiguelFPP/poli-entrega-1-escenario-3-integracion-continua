import type { Request } from 'express';

/** Lee una cookie sin propagar `any` del parseo de cookie-parser. */
export function readCookie(request: Request, name: string): string | undefined {
  const cookies: unknown = request.cookies;

  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const value = (cookies as Record<string, unknown>)[name];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
