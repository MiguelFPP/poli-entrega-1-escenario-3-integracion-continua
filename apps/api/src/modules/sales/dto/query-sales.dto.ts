import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../products/dto/query-products.dto.js';

export const SALE_STATUSES = ['COMPLETED', 'VOIDED'] as const;

export type SaleStatusName = (typeof SALE_STATUSES)[number];

/** Filtros y paginación del listado de ventas. */
export class QuerySalesDto {
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
    description: 'Cantidad de ventas por página (máximo 100).',
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
      'Filtra por estado: `COMPLETED` (vigentes, cuentan en los KPIs) o `VOIDED` (anuladas, fuera de los KPIs).',
    enum: SALE_STATUSES,
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsIn(SALE_STATUSES, {
    message: `status debe ser uno de: ${SALE_STATUSES.join(', ')}`,
  })
  status?: SaleStatusName;

  @ApiPropertyOptional({
    description:
      'Fecha inicial inclusive en ISO 8601 (UTC); se compara contra `createdAt`.',
    format: 'date-time',
    example: '2026-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from debe ser una fecha ISO 8601 válida' })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fecha final inclusive en ISO 8601 (UTC); se compara contra `createdAt`.',
    format: 'date-time',
    example: '2026-02-28T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to debe ser una fecha ISO 8601 válida' })
  to?: string;
}
