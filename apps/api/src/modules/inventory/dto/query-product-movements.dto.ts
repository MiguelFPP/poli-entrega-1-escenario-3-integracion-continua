import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../products/dto/query-products.dto.js';

export const STOCK_MOVEMENT_TYPES = [
  'ENTRY',
  'SALE',
  'ADJUSTMENT',
  'VOID',
] as const;

export type StockMovementTypeName = (typeof STOCK_MOVEMENT_TYPES)[number];

/** Paginación y filtro de tipo del historial de stock de un producto. */
export class QueryProductMovementsDto {
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
    description: 'Cantidad de movimientos por página (máximo 100).',
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
      'Filtra por tipo de movimiento: `ENTRY`, `SALE`, `ADJUSTMENT` o `VOID`.',
    enum: STOCK_MOVEMENT_TYPES,
    example: 'ENTRY',
  })
  @IsOptional()
  @IsIn(STOCK_MOVEMENT_TYPES, {
    message: `type debe ser uno de: ${STOCK_MOVEMENT_TYPES.join(', ')}`,
  })
  type?: StockMovementTypeName;
}
