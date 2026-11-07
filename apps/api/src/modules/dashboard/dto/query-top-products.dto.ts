import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DashboardRangeDto } from './dashboard-range.dto.js';

export const TOP_PRODUCT_SORT_FIELDS = [
  'quantity',
  'revenue',
  'profit',
] as const;

export type TopProductSortField = (typeof TOP_PRODUCT_SORT_FIELDS)[number];

export const DEFAULT_TOP_PRODUCTS_LIMIT = 10;
export const MAX_TOP_PRODUCTS_LIMIT = 50;

/** Rango, cantidad y criterio del top de productos. */
export class QueryTopProductsDto extends DashboardRangeDto {
  @ApiPropertyOptional({
    description: 'Cantidad máxima de productos devueltos (1 a 50).',
    example: 10,
    minimum: 1,
    maximum: MAX_TOP_PRODUCTS_LIMIT,
    default: DEFAULT_TOP_PRODUCTS_LIMIT,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(MAX_TOP_PRODUCTS_LIMIT, {
    message: `limit no puede superar ${MAX_TOP_PRODUCTS_LIMIT}`,
  })
  limit: number = DEFAULT_TOP_PRODUCTS_LIMIT;

  @ApiPropertyOptional({
    description:
      'Criterio de orden descendente: `quantity` (unidades vendidas), `revenue` (`sum(lineTotal)`) o `profit` (`sum(lineProfit)`). El empate se resuelve por nombre y luego por id.',
    enum: TOP_PRODUCT_SORT_FIELDS,
    example: 'quantity',
    default: 'quantity',
  })
  @IsOptional()
  @IsIn(TOP_PRODUCT_SORT_FIELDS, {
    message: `sortBy debe ser uno de: ${TOP_PRODUCT_SORT_FIELDS.join(', ')}`,
  })
  sortBy: TopProductSortField = 'quantity';
}
