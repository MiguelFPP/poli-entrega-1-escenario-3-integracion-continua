import { describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import type { AuthService, AuthSession } from './auth.service.js';
import type { AuthUserDto } from './dto/auth-user.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SessionContext } from './session-context.js';
import type { IssuedTokens } from './types/issued-tokens.js';

const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';

const PROFILE: AuthUserDto = {
  id: USER_ID,
  name: 'Administrador POS',
  email: 'admin@pos.local',
  role: Role.ADMIN,
  active: true,
  createdAt: '2026-01-15T12:00:00.000Z',
};

const TOKENS: IssuedTokens = {
  accessToken: 'access.jwt.token',
  refreshToken: 'refresh-opaco',
};

const SESSION: AuthSession = { user: PROFILE, tokens: TOKENS };

const LOGIN: LoginDto = { email: 'admin@pos.local', password: 'Admin123!' };

const CONTEXT: SessionContext = { userAgent: 'jest', ip: '127.0.0.1' };

const REQUEST_USER: AuthenticatedUser = {
  id: USER_ID,
  email: 'admin@pos.local',
  role: Role.ADMIN,
};

type RequestDouble = {
  headers: Record<string, string | undefined>;
  cookies: Record<string, string>;
  ip?: string;
};

function createRequest(overrides: Partial<RequestDouble> = {}): Request {
  return {
    headers: { 'user-agent': 'jest' },
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function createController(nodeEnv = 'production') {
  const login =
    jest.fn<(dto: LoginDto, context: SessionContext) => Promise<AuthSession>>();
  const refresh =
    jest.fn<
      (rawToken: string, context: SessionContext) => Promise<AuthSession>
    >();
  const logout = jest.fn<(rawToken: string | undefined) => Promise<void>>();
  const getProfile = jest.fn<(userId: string) => Promise<AuthUserDto>>();

  const auth = { login, refresh, logout, getProfile } as unknown as AuthService;

  const get = jest.fn<(key: string) => string | undefined>(() => nodeEnv);
  const config = { get } as unknown as ConfigService;

  const cookie =
    jest.fn<
      (name: string, value: string, options: Record<string, unknown>) => unknown
    >();
  const clearCookie =
    jest.fn<(name: string, options: Record<string, unknown>) => unknown>();
  const response = { cookie, clearCookie } as unknown as Response;

  return {
    controller: new AuthController(auth, config),
    login,
    refresh,
    logout,
    getProfile,
    get,
    response,
    cookie,
    clearCookie,
  };
}

describe('AuthController.login', () => {
  it('abre la sesión, fija las cookies y no expone los tokens en el body', async () => {
    const { controller, login, response, cookie } = createController();
    login.mockResolvedValue(SESSION);

    const result = await controller.login(LOGIN, createRequest(), response);

    expect(login).toHaveBeenCalledWith(LOGIN, CONTEXT);
    expect(cookie).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      user: PROFILE,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('marca las cookies como seguras solo en producción', async () => {
    const production = createController('production');
    production.login.mockResolvedValue(SESSION);

    await production.controller.login(LOGIN, createRequest(), production.response);

    const productionOptions = production.cookie.mock.calls[0]?.[2];
    expect(productionOptions).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });

    const development = createController('development');
    development.login.mockResolvedValue(SESSION);

    await development.controller.login(
      LOGIN,
      createRequest(),
      development.response,
    );

    expect(development.cookie.mock.calls[0]?.[2]).toMatchObject({
      secure: false,
      path: '/',
    });
  });
});

describe('AuthController.refresh', () => {
  it('rechaza la rotación cuando no hay cookie de refresh', async () => {
    const { controller, refresh, response } = createController();

    await expect(
      controller.refresh(createRequest(), response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('rota la sesión a partir de la cookie y reemplaza las cookies', async () => {
    const { controller, refresh, response, cookie } = createController();
    refresh.mockResolvedValue(SESSION);

    const result = await controller.refresh(
      createRequest({ cookies: { refresh_token: 'refresh-opaco' } }),
      response,
    );

    expect(refresh).toHaveBeenCalledWith('refresh-opaco', CONTEXT);
    expect(cookie).toHaveBeenCalledTimes(2);
    expect(result.user).toEqual(PROFILE);
  });
});

describe('AuthController.logout', () => {
  it('revoca el refresh de la cookie y limpia ambas cookies', async () => {
    const { controller, logout, response, clearCookie } = createController();
    logout.mockResolvedValue(undefined);

    await controller.logout(
      createRequest({ cookies: { refresh_token: 'refresh-opaco' } }),
      response,
    );

    expect(logout).toHaveBeenCalledWith('refresh-opaco');
    expect(clearCookie).toHaveBeenCalledTimes(2);
    expect(clearCookie.mock.calls[0]?.[1]).toMatchObject({ path: '/' });
  });

  it('limpia las cookies aunque no haya refresh token', async () => {
    const { controller, logout, response, clearCookie } = createController();
    logout.mockResolvedValue(undefined);

    await controller.logout(createRequest(), response);

    expect(logout).toHaveBeenCalledWith(undefined);
    expect(clearCookie).toHaveBeenCalledTimes(2);
  });
});

describe('AuthController.me', () => {
  it('devuelve el perfil del usuario autenticado', async () => {
    const { controller, getProfile } = createController();
    getProfile.mockResolvedValue(PROFILE);

    await expect(controller.me(REQUEST_USER)).resolves.toBe(PROFILE);
    expect(getProfile).toHaveBeenCalledWith(USER_ID);
  });
});
