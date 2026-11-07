import { ApiProperty } from '@nestjs/swagger';

/** Categoría del producto en riesgo de agotamiento (resumen). */
export class LowStockCategoryDto {
  @ApiProperty({
    description: 'Identificador único de la categoría.',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre de la categoría.',
    example: 'Bebidas',
  })
  name!: string;
}

/** Producto activo con `stock <= minStock`. */
export class LowStockItemDto {
  @ApiProperty({
    description: 'Identificador único del producto.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  id!: string;

  @ApiProperty({
    description: 'SKU del producto.',
    example: 'BEB-001',
  })
  sku!: string;

  @ApiProperty({
    description: 'Nombre comercial del producto.',
    example: 'Agua Cristal 600 ml',
  })
  name!: string;

  @ApiProperty({
    description: 'Categoría del producto (resumen).',
    type: LowStockCategoryDto,
  })
  category!: LowStockCategoryDto;

  @ApiProperty({
    description: 'Stock actual.',
    example: 4,
    minimum: 0,
  })
  stock!: number;

  @ApiProperty({
    description: 'Stock mínimo configurado para el producto.',
    example: 24,
    minimum: 0,
  })
  minStock!: number;

  @ApiProperty({
    description: 'Unidad de medida visible.',
    example: 'botella',
  })
  unit!: string;

  @ApiProperty({
    description:
      'Unidades faltantes para alcanzar el mínimo (`minStock - stock`, nunca negativo).',
    example: 20,
    minimum: 0,
  })
  deficit!: number;

  @ApiProperty({
    description: 'Costo unitario en COP.',
    example: 1200,
    minimum: 0,
  })
  costPrice!: number;

  @ApiProperty({
    description:
      'Valorización del stock disponible en COP (`stock * costPrice`).',
    example: 4800,
    minimum: 0,
  })
  inventoryValue!: number;

  @ApiProperty({
    description: 'Siempre `true`: el listado solo devuelve productos críticos.',
    example: true,
  })
  lowStock!: boolean;
}
