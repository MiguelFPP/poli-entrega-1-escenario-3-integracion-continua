import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CATEGORY_WITH_COUNT_SELECT,
  toCategoryResponseDto,
} from './categories.mapper.js';
import type { CategoryResponseDto } from './dto/category-response.dto.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { QueryCategoriesDto } from './dto/query-categories.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

const CATEGORY_NAME_TAKEN = 'Ya existe una categoría con ese nombre';
const CATEGORY_NOT_FOUND = 'Categoría no encontrada';
const CATEGORY_HAS_ACTIVE_PRODUCTS =
  'No se puede desactivar una categoría con productos activos';

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
}

/** Recorta la descripción y convierte el vacío en `null`. */
function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description === undefined || description === null) {
    return null;
  }

  const trimmed = description.trim();

  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado completo ordenado por nombre, con filtros de estado y búsqueda. */
  async list(query: QueryCategoriesDto): Promise<CategoryResponseDto[]> {
    const where: Prisma.CategoryWhereInput = {};
    const search = query.search?.trim();

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (query.active === 'true') {
      where.active = true;
    }

    if (query.active === 'false') {
      where.active = false;
    }

    const categories = await this.prisma.category.findMany({
      where,
      select: CATEGORY_WITH_COUNT_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return categories.map((category) => toCategoryResponseDto(category));
  }

  /** Crea una categoría con nombre único (sin distinguir mayúsculas). */
  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const name = dto.name.trim();

    await this.assertNameAvailable(name);

    try {
      const category = await this.prisma.category.create({
        data: {
          name,
          description: normalizeDescription(dto.description),
          active: dto.active ?? true,
        },
        select: CATEGORY_WITH_COUNT_SELECT,
      });

      return toCategoryResponseDto(category);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Actualiza nombre, descripción y/o estado de la categoría. */
  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    if (
      dto.name === undefined &&
      dto.description === undefined &&
      dto.active === undefined
    ) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.assertExists(id);

    const data: Prisma.CategoryUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      await this.assertNameAvailable(name, id);
      data.name = name;
    }

    if (dto.description !== undefined) {
      data.description = normalizeDescription(dto.description);
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data,
        select: CATEGORY_WITH_COUNT_SELECT,
      });

      return toCategoryResponseDto(category);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /**
   * Borrado lógico: marca `active = false`. Idempotente. Rechaza con `409` si
   * la categoría todavía tiene productos activos.
   */
  async remove(id: string): Promise<CategoryResponseDto> {
    await this.assertExists(id);

    const activeProducts = await this.prisma.product.count({
      where: { categoryId: id, active: true },
    });

    if (activeProducts > 0) {
      throw new ConflictException(CATEGORY_HAS_ACTIVE_PRODUCTS);
    }

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: { active: false },
        select: CATEGORY_WITH_COUNT_SELECT,
      });

      return toCategoryResponseDto(category);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async assertExists(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(CATEGORY_NOT_FOUND);
    }
  }

  private async assertNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(CATEGORY_NAME_TAKEN);
    }
  }

  /** Traduce errores de Prisma a excepciones HTTP. */
  private toHttpError(error: unknown): Error {
    const code = prismaErrorCode(error);

    if (code === RECORD_NOT_FOUND) {
      return new NotFoundException(CATEGORY_NOT_FOUND);
    }

    if (code === UNIQUE_VIOLATION) {
      return new ConflictException(CATEGORY_NAME_TAKEN);
    }

    return error instanceof Error
      ? error
      : new Error('Error inesperado al guardar la categoría');
  }
}
