import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeResponseDto } from './dashboard-summary.dto.js';
import {
  TOP_PRODUCT_SORT_FIELDS,
  type TopProductSortField,
} from './query-top-products.dto.js';

/** Producto vendido, agregado por el snapshot congelado en las líneas. */
export class TopProductItemDto {
  @ApiProperty({
    description: 'Identificador del producto vendido.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  productId!: string;

  @ApiProperty({
    description:
      'Nombre del producto tomado del snapshot de la línea más reciente del rango.',
    example: 'Agua Cristal 600 ml',
  })
  name!: string;

  @ApiProperty({
    description:
      'SKU del producto tomado del snapshot de la línea más reciente del rango.',
    example: 'BEB-001',
  })
  sku!: string;

  @ApiProperty({
    description: 'Unidades vendidas en el rango.',
    example: 5,
    minimum: 0,
  })
  quantity!: number;

  @ApiProperty({
    description: 'Ingresos en COP: `sum(SaleItem.lineTotal)`, IVA incluido.',
    example: 48000,
    minimum: 0,
  })
  revenue!: number;

  @ApiProperty({
    description: 'Ganancia en COP: `sum(SaleItem.lineProfit)` (sin IVA).',
    example: 7836.13,
  })
  profit!: number;
}

/** Top de productos vendidos en el rango, ordenado por la métrica pedida. */
export class TopProductsDto {
  @ApiProperty({
    description: 'Rango aplicado al reporte (ISO 8601, UTC).',
    type: DashboardRangeResponseDto,
  })
  range!: DashboardRangeResponseDto;

  @ApiProperty({
    description: 'Criterio de orden aplicado.',
    enum: TOP_PRODUCT_SORT_FIELDS,
    example: 'quantity',
  })
  sortBy!: TopProductSortField;

  @ApiProperty({
    description:
      'Productos ordenados descendentemente por `sortBy` (empate por nombre y luego por id), limitados a `limit`.',
    type: () => [TopProductItemDto],
  })
  data!: TopProductItemDto[];
}
