import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { PaginatedUsersDto } from './dto/paginated-users.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import type { UpdatePasswordDto } from './dto/update-password.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

const USER_ID = '9b2f0b7a-1b6c-4c8d-9e2a-3f4b5c6d7e8f';

const USER: UserResponseDto = {
  id: USER_ID,
  name: 'Cajera Turno Mañana',
  email: 'cajera@pos.local',
  role: Role.ADMIN,
  active: true,
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-20T08:30:00.000Z',
};

const PAGE: PaginatedUsersDto = {
  data: [USER],
  meta: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const CURRENT_USER: AuthenticatedUser = {
  id: USER_ID,
  email: 'cajera@pos.local',
  role: Role.ADMIN,
};

function createController() {
  const list = jest.fn<(query: QueryUsersDto) => Promise<PaginatedUsersDto>>();
  const create = jest.fn<(dto: CreateUserDto) => Promise<UserResponseDto>>();
  const update =
    jest.fn<(id: string, dto: UpdateUserDto) => Promise<UserResponseDto>>();
  const updatePassword =
    jest.fn<(id: string, dto: UpdatePasswordDto) => Promise<void>>();
  const deactivate =
    jest.fn<(id: string, requesterId: string) => Promise<UserResponseDto>>();

  const users = {
    list,
    create,
    update,
    updatePassword,
    deactivate,
  } as unknown as UsersService;

  return {
    controller: new UsersController(users),
    list,
    create,
    update,
    updatePassword,
    deactivate,
  };
}

describe('UsersController', () => {
  it('lista usuarios delegando en el servicio con los filtros', async () => {
    const { controller, list } = createController();
    const query: QueryUsersDto = { page: 2, pageSize: 10, search: 'cajera' };
    list.mockResolvedValue(PAGE);

    const result = await controller.list(query);

    expect(list).toHaveBeenCalledWith(query);
    expect(result).toBe(PAGE);
  });

  it('crea un usuario administrador y devuelve el DTO del servicio', async () => {
    const { controller, create } = createController();
    const dto: CreateUserDto = {
      name: 'Cajera Turno Mañana',
      email: 'cajera@pos.local',
      password: 'Cajera2026!',
    };
    create.mockResolvedValue(USER);

    const result = await controller.create(dto);

    expect(create).toHaveBeenCalledWith(dto);
    expect(result).toBe(USER);
  });

  it('actualiza un usuario por id', async () => {
    const { controller, update } = createController();
    const dto: UpdateUserDto = { name: 'Cajera Turno Tarde', active: false };
    update.mockResolvedValue(USER);

    const result = await controller.update(USER_ID, dto);

    expect(update).toHaveBeenCalledWith(USER_ID, dto);
    expect(result).toBe(USER);
  });

  it('cambia la contraseña sin devolver contenido', async () => {
    const { controller, updatePassword } = createController();
    const dto: UpdatePasswordDto = { password: 'Nueva2026!' };
    updatePassword.mockResolvedValue(undefined);

    await expect(controller.updatePassword(USER_ID, dto)).resolves.toBeUndefined();
    expect(updatePassword).toHaveBeenCalledWith(USER_ID, dto);
  });

  it('desactiva un usuario pasando el id del solicitante', async () => {
    const { controller, deactivate } = createController();
    deactivate.mockResolvedValue({ ...USER, active: false });

    const result = await controller.deactivate(USER_ID, CURRENT_USER);

    expect(deactivate).toHaveBeenCalledWith(USER_ID, CURRENT_USER.id);
    expect(result.active).toBe(false);
  });
});
