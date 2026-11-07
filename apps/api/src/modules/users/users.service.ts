import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, type Prisma } from '../../generated/prisma/client.js';
import {
  hashPassword,
  normalizeEmail,
} from '../../common/security/password.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { PaginatedUsersDto } from './dto/paginated-users.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import type { UpdatePasswordDto } from './dto/update-password.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import {
  USER_PUBLIC_SELECT,
  toUserResponseDto,
  type UserPublic,
} from './users.mapper.js';

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

const EMAIL_TAKEN = 'Ya existe un usuario con ese email';
const USER_NOT_FOUND = 'Usuario no encontrado';

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Listado paginado con búsqueda por nombre/email y filtro de estado. */
  async list(query: QueryUsersDto): Promise<PaginatedUsersDto> {
    const { page, pageSize } = query;
    const where: Prisma.UserWhereInput = {};
    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.active === 'true') {
      where.active = true;
    }

    if (query.active === 'false') {
      where.active = false;
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      data: users.map((user) => toUserResponseDto(user)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: total > 0 && page > 1,
      },
    };
  }

  /** Crea un usuario administrador (rol fijo en el MVP). */
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const email = normalizeEmail(dto.email);

    await this.assertEmailAvailable(email);

    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          role: Role.ADMIN,
        },
        select: USER_PUBLIC_SELECT,
      });

      return toUserResponseDto(user);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Actualiza nombre, email o estado (`active`). */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.active === undefined
    ) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    const email =
      dto.email === undefined ? undefined : normalizeEmail(dto.email);
    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (email !== undefined) {
      data.email = email;
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    if (email !== undefined) {
      await this.assertEmailAvailable(email, id);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        select: USER_PUBLIC_SELECT,
      });

      if (dto.active === false) {
        await this.tokens.revokeAllForUser(id);
      }

      return toUserResponseDto(user);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Cambia la contraseña y cierra las sesiones activas del usuario. */
  async updatePassword(id: string, dto: UpdatePasswordDto): Promise<void> {
    const passwordHash = await hashPassword(dto.password);

    try {
      await this.prisma.user.update({
        where: { id },
        data: { passwordHash },
        select: { id: true },
      });
    } catch (error) {
      throw this.toHttpError(error);
    }

    await this.tokens.revokeAllForUser(id);
  }

  /** Desactiva la cuenta; no permite que un admin se desactive a sí mismo. */
  async deactivate(id: string, requesterId: string): Promise<UserResponseDto> {
    if (id === requesterId) {
      throw new BadRequestException('No puedes desactivar tu propio usuario');
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { active: false },
        select: USER_PUBLIC_SELECT,
      });

      await this.tokens.revokeAllForUser(id);

      return toUserResponseDto(user);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async assertEmailAvailable(
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const existing: Pick<UserPublic, 'id'> | null =
      await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(EMAIL_TAKEN);
    }
  }

  /** Traduce errores de Prisma a excepciones HTTP. */
  private toHttpError(error: unknown): Error {
    const code = prismaErrorCode(error);

    if (code === RECORD_NOT_FOUND) {
      return new NotFoundException(USER_NOT_FOUND);
    }

    if (code === UNIQUE_VIOLATION) {
      return new ConflictException(EMAIL_TAKEN);
    }

    return error instanceof Error
      ? error
      : new Error('Error inesperado al guardar el usuario');
  }
}
