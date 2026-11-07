import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PRODUCT_SORT_FIELDS = [
  'name',
  'salePrice',
  'stock',
  'createdAt',
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

/** Filtros, orden y paginación del listado de productos. */
export class QueryProductsDto {
  @ApiPropertyOptional({
    description: 'Página solicitada (1-based).',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de productos por página (máximo 100).',
    example: 20,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'pageSize debe ser un número entero' })
  @Min(1, { message: 'pageSize debe ser mayor o igual a 1' })
  @Max(MAX_PAGE_SIZE, {
    message: `pageSize no puede superar ${MAX_PAGE_SIZE}`,
  })
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description:
      'Búsqueda parcial (insensible a mayúsculas) sobre nombre, SKU y código de barras.',
    example: 'agua',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'search debe ser texto' })
  @MaxLength(100, { message: 'search no puede superar 100 caracteres' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtra por categoría (UUID).',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId debe ser un UUID v4' })
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Filtra por estado (`true` = activos, `false` = inactivos). Se envía como texto en el query string.',
    enum: ['true', 'false'],
    example: 'true',
    type: String,
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'active debe ser "true" o "false"' })
  active?: 'true' | 'false';

  @ApiPropertyOptional({
    description:
      '`true` devuelve solo productos con `stock <= minStock`; `false` solo los que están por encima del mínimo.',
    enum: ['true', 'false'],
    example: 'true',
    type: String,
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'lowStock debe ser "true" o "false"' })
  lowStock?: 'true' | 'false';

  @ApiPropertyOptional({
    description: 'Campo de ordenamiento.',
    enum: PRODUCT_SORT_FIELDS,
    example: 'name',
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS, {
    message: `sort debe ser uno de: ${PRODUCT_SORT_FIELDS.join(', ')}`,
  })
  sort: ProductSortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento.',
    enum: SORT_ORDERS,
    example: 'asc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS, { message: 'order debe ser "asc" o "desc"' })
  order: SortOrder = 'desc';
}
