import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { QueryProductMovementsDto } from './query-product-movements.dto.js';

/** Filtros y paginación del listado general de movimientos de stock. */
export class QueryMovementsDto extends QueryProductMovementsDto {
  @ApiPropertyOptional({
    description: 'Filtra los movimientos de un producto (UUID v4).',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  @IsOptional()
  @IsUUID('4', { message: 'productId debe ser un UUID v4' })
  productId?: string;

  @ApiPropertyOptional({
    description:
      'Fecha inicial inclusive en ISO 8601 (UTC); se compara contra `createdAt`.',
    format: 'date-time',
    example: '2026-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'from debe ser una fecha ISO 8601 válida' },
  )
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
