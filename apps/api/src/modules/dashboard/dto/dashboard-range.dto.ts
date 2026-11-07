import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/** Rango de fechas (ISO 8601, UTC) que acotan los KPIs del dashboard. */
export class DashboardRangeDto {
  @ApiPropertyOptional({
    description:
      'Fecha inicial **inclusive** en ISO 8601 (UTC); se compara contra `Sale.createdAt`. Por defecto, 30 días antes de `to`. Debe ser menor o igual que `to` (`400`).',
    format: 'date-time',
    example: '2026-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from debe ser una fecha ISO 8601 válida' })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fecha final **inclusive** en ISO 8601 (UTC); se compara contra `Sale.createdAt`. Por defecto, el momento de la consulta.',
    format: 'date-time',
    example: '2026-02-28T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to debe ser una fecha ISO 8601 válida' })
  to?: string;
}
