import {
  Body,
  Controller,
  Delete,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { CategoriesService } from './categories.service.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { QueryCategoriesDto } from './dto/query-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const CATEGORY_ID_PARAM = {
  name: 'id',
  description: 'Identificador UUID de la categoría.',
  format: 'uuid',
  example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
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

/** Catálogo de categorías: todo el módulo exige rol `ADMIN`. */
@ApiTags('Categories')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar categorías',
    description: [
      'Devuelve **todas** las categorías ordenadas por nombre (sin paginar).',
      '',
      'Cada elemento incluye `productCount`: productos no eliminados lógicamente',
      'asociados a la categoría. `search` filtra de forma parcial e insensible a',
      'mayúsculas por nombre. `active` filtra por estado (`true`/`false`).',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'active',
    required: false,
    description: 'Filtra por estado de la categoría.',
    enum: ['true', 'false'],
    example: 'true',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Búsqueda parcial por nombre (insensible a mayúsculas).',
    example: 'beb',
  })
  @ApiOkResponse({
    description: 'Categorías que cumplen los filtros.',
    type: [CategoryResponseDto],
  })
  @ApiBadRequestResponse({
    description: 'Filtros inválidos (`active` distinto de `true`/`false`).',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async list(
    @Query() query: QueryCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    return this.categories.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear categoría',
    description: [
      'Crea una categoría con nombre **único sin distinguir mayúsculas**',
      '(se recorta antes de guardar) y descripción opcional.',
      '',
      'Ejemplo de duplicado: si existe `Bebidas`, crear `bebidas` responde `409`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateCategoryDto,
    examples: {
      conDescripcion: {
        summary: 'Categoría con descripción',
        value: {
          name: 'Bebidas',
          description: 'Bebidas frías y calientes',
        },
      },
      sinDescripcion: {
        summary: 'Categoría solo con nombre',
        value: { name: 'Snacks' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Categoría creada.',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Nombre inválido (menos de 2 caracteres) o payload inválido.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiConflictResponse({
    description: 'Ya existe una categoría con ese nombre (sin distinguir mayúsculas).',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar categoría',
    description: [
      'Actualización parcial de `name`, `description` y/o `active`.',
      '',
      'El nombre sigue siendo único sin distinguir mayúsculas. Enviar',
      '`description: null` vacía la descripción. Desactivar una categoría no',
      'elimina sus productos, pero impide asignarla a productos nuevos.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(CATEGORY_ID_PARAM)
  @ApiBody({
    type: UpdateCategoryDto,
    examples: {
      renombrar: {
        summary: 'Cambiar nombre y descripción',
        value: {
          name: 'Bebidas y jugos',
          description: 'Bebidas frías, calientes y jugos naturales',
        },
      },
      desactivar: {
        summary: 'Desactivar categoría (borrado lógico manual)',
        value: { active: false },
      },
    },
  })
  @ApiOkResponse({
    description: 'Categoría actualizada.',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Payload vacío o campos inválidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'La categoría no existe.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'El nombre ya pertenece a otra categoría.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desactivar categoría (borrado lógico)',
    description: [
      'Marca la categoría como inactiva (`active: false`); **no** la borra de la',
      'base. La operación es idempotente.',
      '',
      'Si la categoría tiene **productos activos** responde `409`: primero hay que',
      'desactivar o reasignar esos productos.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(CATEGORY_ID_PARAM)
  @ApiOkResponse({
    description: 'Categoría desactivada (`active: false`).',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no es un UUID válido.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'La categoría no existe.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'La categoría tiene productos activos.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categories.remove(id);
  }
}
