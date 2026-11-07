import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, resolveAccess } from './middleware';

interface AccessCase {
  readonly pathname: string;
  readonly hasSession: boolean;
  readonly expected: string | null;
}

const CASES: readonly AccessCase[] = [
  { pathname: '/login', hasSession: false, expected: null },
  { pathname: '/dashboard', hasSession: false, expected: '/login' },
  { pathname: '/ventas', hasSession: false, expected: '/login' },
  { pathname: '/', hasSession: false, expected: '/login' },
  { pathname: '/login', hasSession: true, expected: '/dashboard' },
  { pathname: '/dashboard', hasSession: true, expected: null },
  { pathname: '/ventas', hasSession: true, expected: null },
  { pathname: '/', hasSession: true, expected: '/dashboard' },
];

function buildRequest(pathname: string, hasSession: boolean): NextRequest {
  const headers = hasSession
    ? { cookie: 'access_token=token-de-prueba' }
    : undefined;
  return new NextRequest(`http://localhost:3000${pathname}`, { headers });
}

describe('resolveAccess', () => {
  it.each(CASES)(
    'resuelve $pathname con sesión=$hasSession',
    ({ pathname, hasSession, expected }) => {
      expect(resolveAccess(pathname, hasSession)).toEqual({
        redirectTo: expected,
      });
    },
  );
});

describe('middleware', () => {
  it('redirige al login cuando no hay cookie de sesión', () => {
    const response = middleware(buildRequest('/ventas', false));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login',
    );
  });

  it('redirige al dashboard cuando ya hay sesión', () => {
    const response = middleware(buildRequest('/login', true));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/dashboard',
    );
  });

  it('deja pasar las rutas protegidas con sesión', () => {
    const response = middleware(buildRequest('/ventas', true));

    expect(response.headers.get('location')).toBeNull();
  });

  it('deja pasar el login sin sesión', () => {
    const response = middleware(buildRequest('/login', false));

    expect(response.headers.get('location')).toBeNull();
  });
});
