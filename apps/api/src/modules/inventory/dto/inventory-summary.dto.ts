import { ApiProperty } from '@nestjs/swagger';

/** Valorización e indicadores de reposición del inventario activo. */
export class InventorySummaryDto {
  @ApiProperty({
    description: 'Productos activos y no eliminados.',
    example: 42,
    minimum: 0,
  })
  totalProducts!: number;

  @ApiProperty({
    description: 'Suma de las unidades en stock de esos productos.',
    example: 1370,
    minimum: 0,
  })
  totalUnits!: number;

  @ApiProperty({
    description:
      'Valorización total en COP (`sum(stock * costPrice)` redondeado a dos decimales).',
    example: 4827500.5,
    minimum: 0,
  })
  inventoryValue!: number;

  @ApiProperty({
    description: 'Productos con `stock <= minStock` (incluye los agotados).',
    example: 7,
    minimum: 0,
  })
  lowStockCount!: number;

  @ApiProperty({
    description: 'Productos con `stock = 0`.',
    example: 2,
    minimum: 0,
  })
  outOfStockCount!: number;

  @ApiProperty({
    description: 'Momento en que se calculó el resumen (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  generatedAt!: string;
}
