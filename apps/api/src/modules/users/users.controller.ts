import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { PaginatedUsersDto } from './dto/paginated-users.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

const USER_ID_PARAM = {
  name: 'id',
  description: 'Identificador UUID del usuario.',
  format: 'uuid',
  example: '9b2f0b7a-1b6c-4c8d-9e2a-3f4b5c6d7e8f',
} as const;

const PROTECTED_RESPONSES = {
  unauthorized: {
    description: 'Sin access token válido (cookie `access_token` o Bearer).',
    type: ErrorResponseDto,
  },
  forbidden: {
    description:
      'El usuario autenticado no es `ADMIN` o el `Origin` no es `WEB_ORIGIN`.',
    type: ErrorResponseDto,
  },
} as const;

/** Administración de usuarios: todo el módulo exige rol `ADMIN`. */
@ApiTags('Users')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios',
    description: [
      'Devuelve los usuarios paginados, sin `passwordHash`.',
      '',
      '`search` busca de forma parcial e insensible a mayúsculas sobre **nombre** y',
      '**email**. `active` filtra por estado de la cuenta. El orden es por fecha de',
      'creación descendente.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Página de usuarios y metadatos de paginación.',
    type: PaginatedUsersDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de paginación o filtros inválidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async list(@Query() query: QueryUsersDto): Promise<PaginatedUsersDto> {
    return this.users.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear usuario administrador',
    description: [
      'Crea un usuario con rol **`ADMIN`** (el MVP no permite elegir rol) y',
      'contraseña hasheada con bcrypt (coste 12).',
      '',
      'El email se normaliza a minúsculas y es único: un duplicado responde `409`.',
      'La contraseña debe tener al menos 8 caracteres, una mayúscula, una',
      'minúscula y un número.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateUserDto,
    examples: {
      administrador: {
        summary: 'Alta de un segundo administrador',
        value: {
          name: 'Cajera Turno Mañana',
          email: 'cajera@pos.local',
          password: 'Cajera2026!',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Usuario creado (sin `passwordHash`).',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido (email, nombre o política de contraseña).',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiConflictResponse({
    description: 'Ya existe un usuario con ese email.',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: [
      'Actualización parcial: `name`, `email` y/o `active`.',
      '',
      'Desactivar (`active: false`) revoca todos los refresh tokens del usuario,',
      'por lo que sus sesiones no pueden renovarse. Un email duplicado responde',
      '`409`. No se permite borrar usuarios.',
    ].join('\n'),
  })
  @ApiParam(USER_ID_PARAM)
  @ApiBody({
    type: UpdateUserDto,
    examples: {
      renombrar: {
        summary: 'Cambiar nombre y email',
        value: { name: 'Cajera Turno Tarde', email: 'cajera.tarde@pos.local' },
      },
      desactivar: {
        summary: 'Desactivar cuenta',
        value: { active: false },
      },
    },
  })
  @ApiOkResponse({
    description: 'Usuario actualizado.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Payload vacío o campos inválidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El usuario no existe.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'El email ya pertenece a otro usuario.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.users.update(id, dto);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description: [
      'Reemplaza la contraseña por una nueva que cumpla la política',
      '(8+ caracteres, mayúscula, minúscula y número).',
      '',
      'Al cambiarla se revocan los refresh tokens del usuario: sus sesiones',
      'abiertas dejan de poder renovarse.',
    ].join('\n'),
  })
  @ApiParam(USER_ID_PARAM)
  @ApiBody({
    type: UpdatePasswordDto,
    examples: {
      nuevaPassword: {
        summary: 'Nueva contraseña válida',
        value: { password: 'Nueva2026!' },
      },
    },
  })
  @ApiNoContentResponse({
    description: 'Contraseña actualizada; sin contenido en el body.',
  })
  @ApiBadRequestResponse({
    description: 'Contraseña inválida o id no UUID.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El usuario no existe.',
    type: ErrorResponseDto,
  })
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePasswordDto,
  ): Promise<void> {
    await this.users.updatePassword(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar usuario',
    description: [
      'Marca la cuenta como inactiva y revoca sus refresh tokens.',
      '',
      'Un administrador **no puede desactivarse a sí mismo** (`400`). La operación',
      'es idempotente: repetirla devuelve el mismo usuario inactivo.',
    ].join('\n'),
  })
  @ApiParam(USER_ID_PARAM)
  @ApiOkResponse({
    description: 'Usuario desactivado.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'El usuario intenta desactivarse a sí mismo o el id no es UUID.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El usuario no existe.',
    type: ErrorResponseDto,
  })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.users.deactivate(id, currentUser.id);
  }
}
