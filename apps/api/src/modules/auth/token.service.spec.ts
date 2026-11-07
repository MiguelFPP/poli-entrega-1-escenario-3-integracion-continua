import { describe, expect, it } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Role } from '../../generated/prisma/client.js';
import type { UserModel } from '../../generated/prisma/models.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from './jwt.service.js';
import type { SessionContext } from './session-context.js';
import { TokenService, type SessionUser } from './token.service.js';

const ACCESS_SECRET = 'a'.repeat(40);
const REFRESH_SECRET = 'b'.repeat(40);
const CONTEXT: SessionContext = { userAgent: 'jest', ip: '127.0.0.1' };

const USER: UserModel = {
  id: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  name: 'Administrador POS',
  email: 'admin@pos.local',
  passwordHash: '$2b$12$hash-de-prueba',
  role: Role.ADMIN,
  active: true,
  createdAt: new Date('2026-01-15T12:00:00.000Z'),
  updatedAt: new Date('2026-01-15T12:00:00.000Z'),
};

const SESSION_USER: SessionUser = {
  id: USER.id,
  email: USER.email,
  role: USER.role,
  active: USER.active,
};

type StoredToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
};

type CreateTokenArgs = {
  data: Omit<StoredToken, 'id' | 'revokedAt' | 'createdAt'>;
};

type FindTokenArgs = { where: { tokenHash: string } };

type UpdateTokenArgs = {
  where: { id: string };
  data: { revokedAt?: Date };
};

type UpdateManyArgs = {
  where: { tokenHash?: string; userId?: string; revokedAt: Date | null };
  data: { revokedAt: Date };
};

/** Repositorio en memoria que imita las operaciones usadas de Prisma. */
function createHarness(options: { active?: boolean } = {}) {
  const user: UserModel = { ...USER, active: options.active ?? USER.active };
  const rows = new Map<string, StoredToken>();
  let sequence = 0;

  const create = async ({ data }: CreateTokenArgs): Promise<StoredToken> => {
    sequence += 1;
    const row: StoredToken = {
      id: `token-${sequence}`,
      revokedAt: null,
      createdAt: new Date(),
      ...data,
    };

    rows.set(row.id, row);

    return row;
  };

  const findUnique = async ({
    where,
  }: FindTokenArgs): Promise<(StoredToken & { user: UserModel }) | null> => {
    for (const row of rows.values()) {
      if (row.tokenHash === where.tokenHash) {
        return { ...row, user };
      }
    }

    return null;
  };

  const update = async ({
    where,
    data,
  }: UpdateTokenArgs): Promise<StoredToken> => {
    const row = rows.get(where.id);

    if (!row) {
      throw new Error('registro inexistente');
    }

    const updated: StoredToken = { ...row, ...data };
    rows.set(where.id, updated);

    return updated;
  };

  const updateMany = async ({
    where,
    data,
  }: UpdateManyArgs): Promise<{ count: number }> => {
    let count = 0;

    for (const [id, row] of rows) {
      const matchesHash =
        where.tokenHash === undefined || row.tokenHash === where.tokenHash;
      const matchesUser =
        where.userId === undefined || row.userId === where.userId;

      if (matchesHash && matchesUser && row.revokedAt === null) {
        rows.set(id, { ...row, revokedAt: data.revokedAt });
        count += 1;
      }
    }

    return { count };
  };

  const prisma = {
    refreshToken: { create, findUnique, update, updateMany },
    $transaction: async (
      operations: Array<Promise<unknown>>,
    ): Promise<unknown[]> => Promise.all(operations),
  } as unknown as PrismaService;

  const secrets: Record<string, string> = {
    JWT_ACCESS_SECRET: ACCESS_SECRET,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
  };
  const config = {
    getOrThrow: (key: string): string => secrets[key] ?? '',
  } as unknown as ConfigService;

  return {
    service: new TokenService(config, prisma, new JwtService()),
    rows,
  };
}

describe('TokenService.issueSession', () => {
  it('firma un access JWT verificable y guarda solo el hash del refresh', async () => {
    const { service, rows } = createHarness();

    const tokens = await service.issueSession(SESSION_USER, CONTEXT);
    const payload = service.verifyAccessToken(tokens.accessToken);
    const [stored] = [...rows.values()];

    expect(payload).toMatchObject({
      sub: USER.id,
      email: USER.email,
      role: Role.ADMIN,
    });
    expect(payload?.exp).toBeGreaterThan(payload?.iat ?? 0);
    expect(tokens.refreshToken.length).toBeGreaterThan(80);
    expect(stored?.tokenHash).toHaveLength(64);
    expect(stored?.tokenHash).not.toBe(tokens.refreshToken);
    expect(stored?.userAgent).toBe(CONTEXT.userAgent);
    expect(stored?.ip).toBe(CONTEXT.ip);
  });

  it('rechaza un access token manipulado o firmado con otro secreto', async () => {
    const { service } = createHarness();
    const tokens = await service.issueSession(SESSION_USER, CONTEXT);
    const foreign = new JwtService().sign(
      { sub: USER.id, email: USER.email, role: Role.ADMIN },
      'otro-secreto-de-40-caracteres-xxxxxxxxxx',
      900,
    );

    expect(service.verifyAccessToken(`${tokens.accessToken}0`)).toBeNull();
    expect(service.verifyAccessToken('no-es-un-jwt')).toBeNull();
    expect(service.verifyAccessToken(foreign)).toBeNull();
    expect(service.verifyAccessToken(tokens.accessToken)).not.toBeNull();
  });
});

describe('TokenService.rotate', () => {
  it('revoca el refresh usado y emite uno nuevo', async () => {
    const { service, rows } = createHarness();
    const first = await service.issueSession(SESSION_USER, CONTEXT);

    const rotated = await service.rotate(first.refreshToken, CONTEXT);
    const stored = [...rows.values()];

    expect(rotated.tokens.refreshToken).not.toBe(first.refreshToken);
    expect(rotated.user.id).toBe(USER.id);
    expect(stored).toHaveLength(2);
    expect(stored.filter((row) => row.revokedAt === null)).toHaveLength(1);
    expect(
      service.verifyAccessToken(rotated.tokens.accessToken),
    ).not.toBeNull();
  });

  it('rechaza un token desconocido', async () => {
    const { service } = createHarness();

    await expect(
      service.rotate('token-inventado', CONTEXT),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token expirado sin crear una sesión nueva', async () => {
    const { service, rows } = createHarness();
    const tokens = await service.issueSession(SESSION_USER, CONTEXT);

    for (const row of rows.values()) {
      row.expiresAt = new Date(Date.now() - 1000);
    }

    await expect(
      service.rotate(tokens.refreshToken, CONTEXT),
    ).rejects.toMatchObject({ message: 'Refresh token expirado' });
    expect(rows.size).toBe(1);
  });

  it('detecta reuso y revoca todas las sesiones del usuario', async () => {
    const { service, rows } = createHarness();
    const first = await service.issueSession(SESSION_USER, CONTEXT);
    const second = await service.issueSession(SESSION_USER, CONTEXT);

    const rotated = await service.rotate(first.refreshToken, CONTEXT);

    await expect(
      service.rotate(first.refreshToken, CONTEXT),
    ).rejects.toMatchObject({
      message: 'Refresh token revocado: se cerraron todas las sesiones',
    });

    const active = [...rows.values()].filter((row) => row.revokedAt === null);
    expect(active).toHaveLength(0);

    await expect(
      service.rotate(rotated.tokens.refreshToken, CONTEXT),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.rotate(second.refreshToken, CONTEXT),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza la rotación de un usuario desactivado', async () => {
    const { service, rows } = createHarness({ active: false });
    const tokens = await service.issueSession(SESSION_USER, CONTEXT);

    await expect(
      service.rotate(tokens.refreshToken, CONTEXT),
    ).rejects.toMatchObject({ message: 'Usuario inactivo' });
    expect([...rows.values()].every((row) => row.revokedAt !== null)).toBe(
      true,
    );
  });
});

describe('TokenService.revoke', () => {
  it('solo revoca el refresh indicado', async () => {
    const { service, rows } = createHarness();
    const first = await service.issueSession(SESSION_USER, CONTEXT);
    const second = await service.issueSession(SESSION_USER, CONTEXT);

    await service.revoke(first.refreshToken);

    const stored = [...rows.values()];
    expect(stored).toHaveLength(2);
    expect(stored.filter((row) => row.revokedAt === null)).toHaveLength(1);
    expect(service.verifyAccessToken(second.accessToken)).not.toBeNull();
  });

  it('revoca todos los refresh activos del usuario', async () => {
    const { service, rows } = createHarness();
    await service.issueSession(SESSION_USER, CONTEXT);
    await service.issueSession(SESSION_USER, CONTEXT);

    await service.revokeAllForUser(USER.id);

    expect([...rows.values()].every((row) => row.revokedAt !== null)).toBe(
      true,
    );
  });
});
