import { ApiProperty } from '@nestjs/swagger';

/** Producto activo en o por debajo de su stock mínimo. */
export class DashboardLowStockItemDto {
  @ApiProperty({
    description: 'Identificador único del producto.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  id!: string;

  @ApiProperty({
    description: 'SKU del producto.',
    example: 'SNK-002',
  })
  sku!: string;

  @ApiProperty({
    description: 'Nombre comercial del producto.',
    example: 'Chocolatina Jet',
  })
  name!: string;

  @ApiProperty({
    description: 'Stock actual.',
    example: 0,
    minimum: 0,
  })
  stock!: number;

  @ApiProperty({
    description: 'Stock mínimo configurado para el producto.',
    example: 5,
    minimum: 0,
  })
  minStock!: number;

  @ApiProperty({
    description:
      'Unidades faltantes para alcanzar el mínimo (`minStock - stock`, nunca negativo).',
    example: 5,
    minimum: 0,
  })
  deficit!: number;

  @ApiProperty({
    description: 'Unidad de medida visible.',
    example: 'unidad',
  })
  unit!: string;
}

/** Alertas de reposición del dashboard. */
export class DashboardLowStockDto {
  @ApiProperty({
    description:
      'Productos activos y no eliminados con `stock <= minStock`, ordenados por `stock asc, name asc` y limitados a `limit`.',
    type: () => [DashboardLowStockItemDto],
  })
  data!: DashboardLowStockItemDto[];
}
