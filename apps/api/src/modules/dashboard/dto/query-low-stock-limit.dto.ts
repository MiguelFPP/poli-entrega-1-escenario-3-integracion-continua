import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_LOW_STOCK_LIMIT = 10;
export const MAX_LOW_STOCK_LIMIT = 100;

/** Tamaño del listado de productos en o bajo el stock mínimo. */
export class QueryLowStockLimitDto {
  @ApiPropertyOptional({
    description: 'Cantidad máxima de productos devueltos (1 a 100).',
    example: 10,
    minimum: 1,
    maximum: MAX_LOW_STOCK_LIMIT,
    default: DEFAULT_LOW_STOCK_LIMIT,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(MAX_LOW_STOCK_LIMIT, {
    message: `limit no puede superar ${MAX_LOW_STOCK_LIMIT}`,
  })
  limit: number = DEFAULT_LOW_STOCK_LIMIT;
}
