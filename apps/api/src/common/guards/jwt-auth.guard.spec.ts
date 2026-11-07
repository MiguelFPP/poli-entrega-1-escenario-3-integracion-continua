import { describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client.js';
import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/auth.constants.js';
import type { TokenService } from '../../modules/auth/token.service.js';
import type { AccessTokenPayload } from '../../modules/auth/types/access-token-payload.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import {
  extractAccessToken,
  JwtAuthGuard,
  type AuthenticatedRequest,
} from './jwt-auth.guard.js';

const PAYLOAD: AccessTokenPayload = {
  sub: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  email: 'admin@pos.local',
  role: Role.ADMIN,
  iat: 1,
  exp: 2,
};

function createRequest(
  options: { cookies?: Record<string, string>; authorization?: string } = {},
): AuthenticatedRequest {
  const headers: Record<string, string> = {};

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  }

  return {
    cookies: options.cookies ?? {},
    headers,
  } as unknown as AuthenticatedRequest;
}

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(
  options: { isPublic?: boolean; payload?: AccessTokenPayload | null } = {},
) {
  const isPublic = options.isPublic ?? false;
  const payload = options.payload === undefined ? PAYLOAD : options.payload;

  const getAllAndOverride = jest.fn<(...args: unknown[]) => boolean | undefined>(
    () => isPublic,
  );
  const verifyAccessToken =
    jest.fn<(token: string) => AccessTokenPayload | null>(() => payload);

  const reflector = { getAllAndOverride } as unknown as Reflector;
  const tokens = { verifyAccessToken } as unknown as TokenService;

  return {
    guard: new JwtAuthGuard(reflector, tokens),
    getAllAndOverride,
    verifyAccessToken,
  };
}

describe('extractAccessToken', () => {
  it('prefiere la cookie access_token cuando también hay Bearer', () => {
    const request = createRequest({
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
      authorization: 'Bearer header-token',
    });

    expect(extractAccessToken(request)).toBe('cookie-token');
  });

  it('usa el Bearer y recorta los espacios sobrantes', () => {
    const request = createRequest({ authorization: 'Bearer   header-token  ' });

    expect(extractAccessToken(request)).toBe('header-token');
  });

  it('ignora un Bearer vacío', () => {
    const request = createRequest({ authorization: 'Bearer    ' });

    expect(extractAccessToken(request)).toBeUndefined();
  });

  it('ignora una cabecera con otro esquema', () => {
    const request = createRequest({ authorization: 'Basic abc123' });

    expect(extractAccessToken(request)).toBeUndefined();
  });

  it('devuelve undefined sin cookie ni cabecera', () => {
    expect(extractAccessToken(createRequest())).toBeUndefined();
  });
});

describe('JwtAuthGuard', () => {
  it('deja pasar las rutas marcadas como públicas sin verificar el token', () => {
    const { guard, verifyAccessToken, getAllAndOverride } = createGuard({
      isPublic: true,
    });
    const request = createRequest();

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('valida la cookie y adjunta el usuario autenticado a la request', () => {
    const { guard, verifyAccessToken } = createGuard();
    const request = createRequest({
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
    });

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith('cookie-token');
    expect(request.user).toEqual({
      id: PAYLOAD.sub,
      email: PAYLOAD.email,
      role: PAYLOAD.role,
    });
  });

  it('valida el token Bearer cuando no hay cookie', () => {
    const { guard, verifyAccessToken } = createGuard();
    const request = createRequest({ authorization: 'Bearer header-token' });

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith('header-token');
    expect(request.user).toEqual({
      id: PAYLOAD.sub,
      email: PAYLOAD.email,
      role: PAYLOAD.role,
    });
  });

  it('rechaza la petición cuando no hay token', () => {
    const { guard, verifyAccessToken } = createGuard();

    expect(() => guard.canActivate(createContext(createRequest()))).toThrow(
      UnauthorizedException,
    );
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rechaza un token que no puede verificarse', () => {
    const { guard } = createGuard({ payload: null });
    const request = createRequest({
      cookies: { [ACCESS_TOKEN_COOKIE]: 'token-invalido' },
    });

    expect(() => guard.canActivate(createContext(request))).toThrow(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });
});
