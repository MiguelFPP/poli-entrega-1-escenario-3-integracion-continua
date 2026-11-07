import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentMethod,
  SaleStatus,
} from '../../../generated/prisma/client.js';

/** Usuario (resumen) asociado a una venta. */
export class SaleUserDto {
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

/** Línea de venta: snapshot del producto y sus totales. */
export class SaleItemResponseDto {
  @ApiProperty({
    description: 'Identificador único de la línea.',
    format: 'uuid',
    example: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
  })
  id!: string;

  @ApiProperty({
    description: 'Producto vendido.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  productId!: string;

  @ApiProperty({
    description: 'Nombre del producto al momento de la venta.',
    example: 'Agua Cristal 600 ml',
  })
  productName!: string;

  @ApiProperty({
    description: 'SKU del producto al momento de la venta.',
    example: 'BEB-001',
  })
  sku!: string;

  @ApiProperty({
    description: 'Unidades vendidas.',
    example: 2,
    minimum: 1,
  })
  quantity!: number;

  @ApiProperty({
    description: 'Precio unitario en COP al momento de la venta.',
    example: 2000,
    minimum: 0,
  })
  unitPrice!: number;

  @ApiProperty({
    description: 'Costo unitario en COP al momento de la venta.',
    example: 1200,
    minimum: 0,
  })
  unitCost!: number;

  @ApiProperty({
    description: '`unitPrice * quantity` en COP.',
    example: 4000,
    minimum: 0,
  })
  lineSubtotal!: number;

  @ApiProperty({
    description:
      'Parte prorrateada del descuento global que le corresponde a la línea, en COP.',
    example: 400,
    minimum: 0,
  })
  lineDiscount!: number;

  @ApiProperty({
    description:
      'IVA 19% incluido en la línea (`lineTotal - round(lineTotal / 1.19)`), en COP.',
    example: 574.79,
    minimum: 0,
  })
  lineTax!: number;

  @ApiProperty({
    description: '`lineSubtotal - lineDiscount`, en COP.',
    example: 3600,
    minimum: 0,
  })
  lineTotal!: number;

  @ApiProperty({
    description:
      'Ganancia de la línea (`lineTotal - lineTax - unitCost * quantity`), en COP.',
    example: 625.21,
  })
  lineProfit!: number;
}

/** Pago único de la venta. */
export class SalePaymentResponseDto {
  @ApiProperty({
    description: 'Identificador único del pago.',
    format: 'uuid',
    example: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
  })
  id!: string;

  @ApiProperty({
    description: 'Método de pago: `CASH` (efectivo) o `CARD` (tarjeta).',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.CASH,
  })
  method!: PaymentMethod;

  @ApiProperty({
    description: 'Importe cobrado en COP (total de la venta).',
    example: 32130,
    minimum: 0,
  })
  amount!: number;

  @ApiProperty({
    description:
      'Efectivo recibido en COP o `null` cuando el pago es con tarjeta.',
    example: 40000,
    minimum: 0,
    nullable: true,
  })
  cashReceived!: number | null;

  @ApiProperty({
    description:
      'Vuelto entregado en COP (`cashReceived - amount`) o `null` cuando el pago es con tarjeta.',
    example: 7870,
    minimum: 0,
    nullable: true,
  })
  changeGiven!: number | null;

  @ApiProperty({
    description: 'Fecha del pago (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  createdAt!: string;
}

/** Cabecera de venta usada por el listado. */
export class SaleSummaryDto {
  @ApiProperty({
    description: 'Identificador único de la venta.',
    format: 'uuid',
    example: '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f',
  })
  id!: string;

  @ApiProperty({
    description:
      'Número consecutivo visible, tomado de `sale_number_seq` y rellenado a 6 dígitos.',
    example: 'V-000001',
  })
  number!: string;

  @ApiProperty({
    description:
      'Estado de la venta: `COMPLETED` (vigente) o `VOIDED` (anulada, excluida de los KPIs).',
    enum: SaleStatus,
    enumName: 'SaleStatus',
    example: SaleStatus.COMPLETED,
  })
  status!: SaleStatus;

  @ApiProperty({
    description: 'Total cobrado en COP (IVA 19% incluido).',
    example: 32130,
    minimum: 0,
  })
  total!: number;

  @ApiProperty({
    description: 'Cantidad de líneas de la venta.',
    example: 2,
    minimum: 0,
  })
  itemCount!: number;

  @ApiProperty({
    description: 'Método de pago de la venta.',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.CASH,
    nullable: true,
  })
  paymentMethod!: PaymentMethod | null;

  @ApiProperty({
    description: 'Fecha de la venta (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description:
      'Fecha de anulación (ISO 8601, UTC) o `null` si sigue vigente.',
    example: null,
    nullable: true,
  })
  voidedAt!: string | null;

  @ApiProperty({
    description: 'Usuario que registró la venta.',
    type: SaleUserDto,
  })
  user!: SaleUserDto;
}

/** Detalle de venta: cabecera, líneas, pago y datos de anulación. */
export class SaleDetailDto extends SaleSummaryDto {
  @ApiProperty({
    description: 'Suma de los subtotales de las líneas, en COP.',
    example: 35700,
    minimum: 0,
  })
  subtotal!: number;

  @ApiProperty({
    description:
      'Descuento global aplicado, prorrateado entre las líneas, en COP.',
    example: 3570,
    minimum: 0,
  })
  discountAmount!: number;

  @ApiProperty({
    description: 'IVA 19% incluido en el total, en COP.',
    example: 5130,
    minimum: 0,
  })
  taxAmount!: number;

  @ApiProperty({
    description: 'Costo total de las unidades vendidas, en COP.',
    example: 24000,
    minimum: 0,
  })
  costTotal!: number;

  @ApiProperty({
    description:
      'Ganancia de la venta sin IVA menos el costo (`taxAmount` excluido), en COP.',
    example: 3000,
  })
  profit!: number;

  @ApiProperty({
    description: 'Motivo de la anulación o `null` si la venta sigue vigente.',
    example: 'Error de digitación del cajero',
    nullable: true,
  })
  voidReason!: string | null;

  @ApiProperty({
    description: 'Usuario que anuló la venta o `null` si sigue vigente.',
    type: SaleUserDto,
    nullable: true,
  })
  voidedBy!: SaleUserDto | null;

  @ApiProperty({
    description: 'Líneas de la venta con el snapshot del producto.',
    type: () => [SaleItemResponseDto],
  })
  items!: SaleItemResponseDto[];

  @ApiProperty({
    description: 'Pago de la venta o `null` si no se registró.',
    type: SalePaymentResponseDto,
    nullable: true,
  })
  payment!: SalePaymentResponseDto | null;
}
