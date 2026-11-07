import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DashboardRangeDto } from './dashboard-range.dto.js';

export const TREND_GRANULARITIES = ['day', 'week', 'month'] as const;

export type TrendGranularity = (typeof TREND_GRANULARITIES)[number];

/** Rango y granularidad de la tendencia de ventas. */
export class QueryTrendDto extends DashboardRangeDto {
  @ApiPropertyOptional({
    description:
      'Agrupación temporal en la zona `America/Bogota`: `day` (día local, `YYYY-MM-DD`), `week` (lunes de la semana local, `YYYY-MM-DD`) o `month` (`YYYY-MM`).',
    enum: TREND_GRANULARITIES,
    example: 'day',
    default: 'day',
  })
  @IsOptional()
  @IsIn(TREND_GRANULARITIES, {
    message: `granularity debe ser uno de: ${TREND_GRANULARITIES.join(', ')}`,
  })
  granularity: TrendGranularity = 'day';
}
