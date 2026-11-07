import { ApiProperty } from '@nestjs/swagger';
import { StockMovementType } from '../../../generated/prisma/client.js';

/** Producto afectado por un movimiento de stock (resumen). */
export class StockMovementProductDto {
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
}

/** Usuario que registró el movimiento (resumen). */
export class StockMovementUserDto {
  @ApiProperty({
    description: 'Identificador único del usuario.',
    format: 'uuid',
    example: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre visible del usuario.',
    example: 'Administrador POS',
  })
  name!: string;

  @ApiProperty({
    description: 'Email del usuario.',
    format: 'email',
    example: 'admin@pos.local',
  })
  email!: string;
}

/** Movimiento de inventario expuesto por la API. */
export class StockMovementResponseDto {
  @ApiProperty({
    description: 'Identificador único del movimiento.',
    format: 'uuid',
    example: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
  })
  id!: string;

  @ApiProperty({
    description: 'Producto afectado.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  productId!: string;

  @ApiProperty({
    description: 'Resumen del producto afectado.',
    type: StockMovementProductDto,
  })
  product!: StockMovementProductDto;

  @ApiProperty({
    description:
      'Tipo de movimiento: `ENTRY` (entrada), `SALE` (venta), `ADJUSTMENT` (ajuste o merma) o `VOID` (anulación).',
    enum: StockMovementType,
    enumName: 'StockMovementType',
    example: StockMovementType.ENTRY,
  })
  type!: StockMovementType;

  @ApiProperty({
    description:
      'Cantidad firmada: positiva cuando entra mercancía, negativa cuando sale o se ajusta a la baja.',
    example: 24,
  })
  quantity!: number;

  @ApiProperty({
    description: 'Stock del producto antes del movimiento.',
    example: 10,
    minimum: 0,
  })
  previousStock!: number;

  @ApiProperty({
    description: 'Stock del producto después del movimiento.',
    example: 34,
    minimum: 0,
  })
  newStock!: number;

  @ApiProperty({
    description:
      'Costo unitario aplicado en COP: en `ENTRY` el costo de entrada recibido y en `ADJUSTMENT` el costo vigente del producto.',
    example: 1900,
    minimum: 0,
  })
  unitCost!: number;

  @ApiProperty({
    description: 'Motivo registrado o `null` si no se envió.',
    example: 'Compra a proveedor DistriColombia',
    nullable: true,
  })
  reason!: string | null;

  @ApiProperty({
    description:
      'Venta asociada (`SALE`/`VOID`) o `null` en movimientos manuales.',
    format: 'uuid',
    example: null,
    nullable: true,
  })
  saleId!: string | null;

  @ApiProperty({
    description:
      'Usuario que registró el movimiento o `null` si lo hizo un proceso automático.',
    type: StockMovementUserDto,
    nullable: true,
  })
  user!: StockMovementUserDto | null;

  @ApiProperty({
    description: 'Fecha del movimiento (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  createdAt!: string;
}
