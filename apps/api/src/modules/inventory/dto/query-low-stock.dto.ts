import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../products/dto/query-products.dto.js';

/** Filtros y paginación del listado de productos en o bajo el stock mínimo. */
export class QueryLowStockDto {
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
    description: 'Filtra por categoría (UUID v4).',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId debe ser un UUID v4' })
  categoryId?: string;

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
}
