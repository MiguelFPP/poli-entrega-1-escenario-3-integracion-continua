import { ApiProperty } from '@nestjs/swagger';

/** Resumen de la categoría embebido en un producto. */
export class ProductCategoryDto {
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

/** Producto del catálogo expuesto por la API. */
export class ProductResponseDto {
  @ApiProperty({
    description: 'Identificador único (UUID v4).',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  id!: string;

  @ApiProperty({
    description: 'SKU único, normalizado en mayúsculas.',
    example: 'BEB-001',
  })
  sku!: string;

  @ApiProperty({
    description: 'Código de barras único o `null`.',
    example: '7701000000011',
    nullable: true,
  })
  barcode!: string | null;

  @ApiProperty({
    description: 'Nombre comercial del producto.',
    example: 'Agua Cristal 600 ml',
  })
  name!: string;

  @ApiProperty({
    description: 'Descripción del producto o `null`.',
    example: 'Agua purificada sin gas, botella de 600 ml',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Identificador de la categoría asociada.',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Categoría asociada (resumen).',
    type: ProductCategoryDto,
  })
  category!: ProductCategoryDto;

  @ApiProperty({
    description: 'Costo unitario en COP.',
    example: 1200,
    minimum: 0,
  })
  costPrice!: number;

  @ApiProperty({
    description: 'Precio de venta en COP.',
    example: 2000,
    minimum: 0,
  })
  salePrice!: number;

  @ApiProperty({
    description:
      'Stock actual. Es de solo lectura en el catálogo: se modifica con movimientos de inventario (Fase 4).',
    example: 96,
    minimum: 0,
  })
  stock!: number;

  @ApiProperty({
    description: 'Stock mínimo para alertas de reposición.',
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
    description: 'URL de la imagen o `null`.',
    example: 'https://cdn.pos.local/products/agua-cristal-600ml.png',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Si es `false` el producto está inactivo o eliminado lógicamente.',
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description: 'Indica si `stock <= minStock` (requiere reposición).',
    example: false,
  })
  lowStock!: boolean;

  @ApiProperty({
    description: 'Fecha de creación (ISO 8601, UTC).',
    example: '2026-02-10T14:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Fecha de la última actualización (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  updatedAt!: string;
}
