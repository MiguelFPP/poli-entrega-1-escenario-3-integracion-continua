import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserPublic } from './users.mapper.js';
import { UsersService } from './users.service.js';

const USER_ID = '9b2f0b7a-1b6c-4c8d-9e2a-3f4b5c6d7e8f';
const OTHER_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a';

const PASSWORD = 'Cajera2026!';
const TIMESTAMP = new Date('2026-01-15T12:00:00.000Z');

function userRecord(overrides: Partial<UserPublic> = {}): UserPublic {
  return {
    id: USER_ID,
    name: 'Cajera Turno Mañana',
    email: 'cajera@pos.local',
    role: Role.ADMIN,
    active: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function createMocks() {
  const findUnique = jest.fn<
    (args: { where: { id?: string; email?: string }; select?: unknown }) =>
      Promise<{ id: string } | null>
  >();
  const findMany = jest.fn<
    (args: { where?: unknown; select?: unknown; orderBy?: unknown; skip?: number; take?: number }) =>
      Promise<UserPublic[]>
  >();
  const count = jest.fn<(args: { where?: unknown }) => Promise<number>>();
  const create = jest.fn<
    (args: { data: unknown; select?: unknown }) => Promise<UserPublic>
  >();
  const update = jest.fn<
    (args: { where: { id: string }; data: unknown; select?: unknown }) =>
      Promise<UserPublic>
  >();
  const transaction = jest.fn<(ops: Promise<unknown>[]) => Promise<unknown[]>>();

  transaction.mockImplementation((ops) => Promise.all(ops));

  const prisma = {
    user: { findUnique, findMany, count, create, update },
    $transaction: transaction,
  } as unknown as PrismaService;

  const revokeAllForUser = jest.fn<(userId: string) => Promise<void>>();
  revokeAllForUser.mockResolvedValue(undefined);

  const tokens = { revokeAllForUser } as unknown as TokenService;

  return {
    service: new UsersService(prisma, tokens),
    findUnique,
    findMany,
    count,
    create,
    update,
    revokeAllForUser,
  };
}

describe('UsersService.list', () => {
  it('arma búsqueda, filtro de estado y paginación', async () => {
    const { service, findUnique, findMany, count } = createMocks();
    const query: QueryUsersDto = {
      page: 2,
      pageSize: 5,
      search: '  cajera  ',
      active: 'true',
    };

    count.mockResolvedValue(6);
    findMany.mockResolvedValue([userRecord()]);

    const result = await service.list(query);

    expect(findUnique).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'cajera', mode: 'insensitive' } },
          { email: { contains: 'cajera', mode: 'insensitive' } },
        ],
        active: true,
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'cajera', mode: 'insensitive' } },
            { email: { contains: 'cajera', mode: 'insensitive' } },
          ],
          active: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(result.data[0]).toMatchObject({
      id: USER_ID,
      email: 'cajera@pos.local',
      createdAt: '2026-01-15T12:00:00.000Z',
    });
  });

  it('devuelve metadatos vacíos cuando no hay resultados', async () => {
    const { service, findMany, count } = createMocks();
    const query: QueryUsersDto = { page: 1, pageSize: 20, active: 'false' };

    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    const result = await service.list(query);

    const where = count.mock.calls[0]?.[0].where as Record<string, unknown>;
    expect(where).toEqual({ active: false });
    expect(result.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});

describe('UsersService.create', () => {
  it('normaliza el email, hashea la contraseña y fija el rol ADMIN', async () => {
    const { service, findUnique, create } = createMocks();
    const dto: CreateUserDto = {
      name: '  Cajera Turno Mañana ',
      email: '  CAJERA@Pos.Local ',
      password: PASSWORD,
    };

    findUnique.mockResolvedValue(null);
    create.mockResolvedValue(userRecord());

    const result = await service.create(dto);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'cajera@pos.local' },
      select: { id: true },
    });

    const data = create.mock.calls[0]?.[0].data as {
      name: string;
      email: string;
      passwordHash: string;
      role: Role;
    };

    expect(data).toMatchObject({
      name: 'Cajera Turno Mañana',
      email: 'cajera@pos.local',
      role: Role.ADMIN,
    });
    expect(data.passwordHash).not.toBe(PASSWORD);
    expect(data.passwordHash.startsWith('$2')).toBe(true);
    expect(result.id).toBe(USER_ID);
  });

  it('rechaza un email ya registrado sin crear el usuario', async () => {
    const { service, findUnique, create } = createMocks();

    findUnique.mockResolvedValue({ id: OTHER_ID });

    await expect(
      service.create({
        name: 'Cajera',
        email: 'cajera@pos.local',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(create).not.toHaveBeenCalled();
  });
});

describe('UsersService.update', () => {
  it('rechaza una actualización sin campos', async () => {
    const { service, update } = createMocks();

    await expect(service.update(USER_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('rechaza un email que pertenece a otro usuario', async () => {
    const { service, findUnique, update } = createMocks();
    const dto: UpdateUserDto = { email: 'tomado@pos.local' };

    findUnique.mockResolvedValue({ id: OTHER_ID });

    await expect(service.update(USER_ID, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('traduce un registro inexistente en 404', async () => {
    const { service, update } = createMocks();

    update.mockRejectedValue({ code: 'P2025' });

    await expect(
      service.update(USER_ID, { name: 'Otra Cajera' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revoca las sesiones al desactivar la cuenta', async () => {
    const { service, update, revokeAllForUser } = createMocks();
    const dto: UpdateUserDto = { active: false };

    update.mockResolvedValue(userRecord({ active: false }));

    const result = await service.update(USER_ID, dto);

    expect(revokeAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(result.active).toBe(false);
  });

  it('propaga los errores de tipo Error sin transformarlos', async () => {
    const { service, update } = createMocks();

    update.mockRejectedValue(new Error('boom interno'));

    await expect(service.update(USER_ID, { name: 'X' })).rejects.toThrow(
      'boom interno',
    );
  });

  it('convierte un rechazo no-Error en un error genérico', async () => {
    const { service, update } = createMocks();

    update.mockRejectedValue('fallo inesperado');

    await expect(service.update(USER_ID, { name: 'X' })).rejects.toThrow(
      'Error inesperado al guardar el usuario',
    );
  });
});

describe('UsersService.updatePassword', () => {
  it('hashea la nueva contraseña y cierra las sesiones', async () => {
    const { service, update, revokeAllForUser } = createMocks();

    update.mockResolvedValue(userRecord());

    await service.updatePassword(USER_ID, { password: 'Nueva2026!' });

    const data = update.mock.calls[0]?.[0].data as { passwordHash: string };
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: USER_ID },
      select: { id: true },
    });
    expect(data.passwordHash).not.toBe('Nueva2026!');
    expect(data.passwordHash.startsWith('$2')).toBe(true);
    expect(revokeAllForUser).toHaveBeenCalledWith(USER_ID);
  });
});

describe('UsersService.deactivate', () => {
  it('rechaza que un administrador se desactive a sí mismo', async () => {
    const { service, update } = createMocks();

    await expect(service.deactivate(USER_ID, USER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('desactiva la cuenta y revoca sus sesiones', async () => {
    const { service, update, revokeAllForUser } = createMocks();

    update.mockResolvedValue(userRecord({ active: false }));

    const result = await service.deactivate(USER_ID, OTHER_ID);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { active: false },
      }),
    );
    expect(revokeAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(result.active).toBe(false);
  });

  it('traduce un registro inexistente en 404', async () => {
    const { service, update, revokeAllForUser } = createMocks();

    update.mockRejectedValue({ code: 'P2025' });

    await expect(service.deactivate(USER_ID, OTHER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(revokeAllForUser).not.toHaveBeenCalled();
  });
});
