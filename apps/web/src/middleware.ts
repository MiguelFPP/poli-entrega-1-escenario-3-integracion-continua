import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/login']);

const SESSION_COOKIES: readonly string[] = ['access_token', 'refresh_token'];

export interface AccessDecision {
  readonly redirectTo: string | null;
}

/** Decide el acceso por presencia de cookie; la autoridad real es el guard de la API. */
export function resolveAccess(
  pathname: string,
  hasSession: boolean,
): AccessDecision {
  if (!hasSession) {
    return {
      redirectTo: PUBLIC_PATHS.has(pathname) ? null : '/login',
    };
  }

  if (pathname === '/login' || pathname === '/') {
    return { redirectTo: '/dashboard' };
  }

  return { redirectTo: null };
}

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => request.cookies.has(name));
}

export function middleware(request: NextRequest): NextResponse {
  const { redirectTo } = resolveAccess(
    request.nextUrl.pathname,
    hasSessionCookie(request),
  );

  if (!redirectTo) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // `api` queda fuera: el middleware corre antes del rewrite `/api/v1/*`,
  // así que interceptaría las llamadas a la API y rompería el login.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
