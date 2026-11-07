import { describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Role } from '../../generated/prisma/client.js';
import type { UserModel } from '../../generated/prisma/models.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SessionContext } from './session-context.js';
import type { TokenService, SessionUser } from './token.service.js';
import type { IssuedTokens } from './types/issued-tokens.js';

const PASSWORD = 'Admin123!';
const STORED_EMAIL = 'admin@pos.local';
const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';

const CONTEXT: SessionContext = { userAgent: 'jest', ip: '127.0.0.1' };
const TOKENS: IssuedTokens = {
  accessToken: 'header.payload.signature',
  refreshToken: 'refresh-opaco',
};

async function buildUser(
  overrides: Partial<UserModel> = {},
): Promise<UserModel> {
  const timestamp = new Date('2026-01-15T12:00:00.000Z');

  return {
    id: USER_ID,
    name: 'Administrador POS',
    email: STORED_EMAIL,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role: Role.ADMIN,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createService(user: UserModel | null) {
  const findUnique =
    jest.fn<
      (args: {
        where: { email?: string; id?: string };
      }) => Promise<UserModel | null>
    >();
  findUnique.mockResolvedValue(user);

  const prisma = {
    user: { findUnique },
  } as unknown as PrismaService;

  const issueSession =
    jest.fn<
      (user: SessionUser, context: SessionContext) => Promise<IssuedTokens>
    >();
  issueSession.mockResolvedValue(TOKENS);
  const revoke = jest.fn<(rawToken: string) => Promise<void>>();
  revoke.mockResolvedValue(undefined);

  const tokens = {
    issueSession,
    rotate: jest.fn(),
    revoke,
    revokeAllForUser: jest.fn(),
    verifyAccessToken: jest.fn(),
  } as unknown as TokenService;

  return {
    service: new AuthService(prisma, tokens),
    findUnique,
    issueSession,
    revoke,
  };
}

function loginDto(email: string, password: string): LoginDto {
  return { email, password };
}

describe('AuthService.login', () => {
  it('devuelve el usuario sin passwordHash y emite la sesión', async () => {
    const user = await buildUser();
    const { service, issueSession } = createService(user);

    const result = await service.login(
      loginDto(STORED_EMAIL, PASSWORD),
      CONTEXT,
    );

    expect(result.tokens).toEqual(TOKENS);
    expect(result.user).toMatchObject({
      id: USER_ID,
      email: STORED_EMAIL,
      role: Role.ADMIN,
    });
    expect('passwordHash' in result.user).toBe(false);
    expect(issueSession).toHaveBeenCalledWith(user, CONTEXT);
  });

  it('rechaza una contraseña incorrecta sin emitir tokens', async () => {
    const { service, issueSession } = createService(await buildUser());

    await expect(
      service.login(loginDto(STORED_EMAIL, 'OtraClave123!'), CONTEXT),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(issueSession).not.toHaveBeenCalled();
  });

  it('rechaza un email inexistente con el mismo mensaje que una clave errónea', async () => {
    const { service, issueSession } = createService(null);

    await expect(
      service.login(loginDto('nadie@pos.local', PASSWORD), CONTEXT),
    ).rejects.toMatchObject({ message: 'Credenciales inválidas' });

    expect(issueSession).not.toHaveBeenCalled();
  });

  it('rechaza un usuario inactivo aunque la contraseña sea correcta', async () => {
    const { service, issueSession } = createService(
      await buildUser({ active: false }),
    );

    await expect(
      service.login(loginDto(STORED_EMAIL, PASSWORD), CONTEXT),
    ).rejects.toMatchObject({ message: 'Usuario inactivo' });

    expect(issueSession).not.toHaveBeenCalled();
  });

  it('normaliza el email (trim + minúsculas) antes de consultar', async () => {
    const { service, findUnique } = createService(await buildUser());

    await service.login(loginDto('  ADMIN@Pos.Local  ', PASSWORD), CONTEXT);

    expect(findUnique).toHaveBeenCalledWith({ where: { email: STORED_EMAIL } });
  });
});

describe('AuthService.getProfile', () => {
  it('devuelve el perfil sin passwordHash', async () => {
    const { service } = createService(await buildUser());

    const profile = await service.getProfile(USER_ID);

    expect(profile.id).toBe(USER_ID);
    expect(profile.createdAt).toBe('2026-01-15T12:00:00.000Z');
    expect('passwordHash' in profile).toBe(false);
  });

  it('rechaza un usuario inactivo', async () => {
    const { service } = createService(await buildUser({ active: false }));

    await expect(service.getProfile(USER_ID)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.logout', () => {
  it('revoca el refresh recibido', async () => {
    const { service, revoke } = createService(await buildUser());

    await service.logout('refresh-opaco');

    expect(revoke).toHaveBeenCalledWith('refresh-opaco');
  });

  it('no toca la base si no hay refresh token', async () => {
    const { service, revoke } = createService(await buildUser());

    await service.logout(undefined);

    expect(revoke).not.toHaveBeenCalled();
  });
});
