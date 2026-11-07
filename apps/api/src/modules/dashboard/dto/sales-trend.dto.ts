import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeResponseDto } from './dashboard-summary.dto.js';
import {
  TREND_GRANULARITIES,
  type TrendGranularity,
} from './query-trend.dto.js';

/** Bucket de la tendencia con las ventas de un periodo. */
export class SalesTrendPointDto {
  @ApiProperty({
    description:
      'Periodo en zona `America/Bogota`: `YYYY-MM-DD` (día o lunes de la semana) o `YYYY-MM` (mes).',
    example: '2026-02-01',
  })
  period!: string;

  @ApiProperty({
    description:
      'Ventas totales del periodo en COP (`sum(Sale.total)`, IVA incluido).',
    example: 127000,
    minimum: 0,
  })
  totalSales!: number;

  @ApiProperty({
    description:
      'Ventas netas del periodo en COP **sin IVA** (`sum(Sale.total - Sale.taxAmount)`).',
    example: 106722.69,
    minimum: 0,
  })
  netSales!: number;

  @ApiProperty({
    description: 'Ganancia bruta del periodo en COP (`sum(Sale.profit)`).',
    example: 20722.69,
  })
  grossProfit!: number;

  @ApiProperty({
    description: 'Ventas `COMPLETED` del periodo.',
    example: 2,
    minimum: 0,
  })
  transactions!: number;
}

/** Serie temporal de ventas agrupada por `day`, `week` o `month`. */
export class SalesTrendDto {
  @ApiProperty({
    description: 'Rango aplicado al reporte (ISO 8601, UTC).',
    type: DashboardRangeResponseDto,
  })
  range!: DashboardRangeResponseDto;

  @ApiProperty({
    description: 'Granularidad usada en la agrupación.',
    enum: TREND_GRANULARITIES,
    example: 'day',
  })
  granularity!: TrendGranularity;

  @ApiProperty({
    description:
      'Buckets con ventas, ordenados por periodo ascendente. Los periodos sin ventas no aparecen.',
    type: () => [SalesTrendPointDto],
  })
  data!: SalesTrendPointDto[];
}
