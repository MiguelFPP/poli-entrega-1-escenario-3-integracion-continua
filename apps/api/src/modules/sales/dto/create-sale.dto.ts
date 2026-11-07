import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Importe máximo soportado por `Decimal(14, 2)`. */
const MAX_MONEY = 999_999_999_999.99;

/** Cota de cantidad: evita desbordar el `Int` de `stock`. */
const MAX_QUANTITY = 1_000_000;

/** Líneas por venta. */
export const MAX_SALE_ITEMS = 100;

export const PAYMENT_METHODS = ['CASH', 'CARD'] as const;

export type PaymentMethodName = (typeof PAYMENT_METHODS)[number];

/** Producto y cantidad dentro del carrito. */
export class SaleItemInputDto {
  @ApiProperty({
    description:
      'Producto vendido (UUID v4). Debe existir, estar activo, no estar eliminado y tener stock suficiente; si no, la venta responde `404`, `400` o `409`.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  @IsUUID('4', { message: 'productId debe ser un UUID v4' })
  productId!: string;

  @ApiProperty({
    description:
      'Unidades vendidas (entero `>= 1`). El stock se descuenta con esta cantidad.',
    example: 2,
    minimum: 1,
    maximum: MAX_QUANTITY,
  })
  @Type(() => Number)
  @IsInt({ message: 'quantity debe ser un número entero' })
  @Min(1, { message: 'quantity debe ser mayor o igual a 1' })
  @Max(MAX_QUANTITY, { message: `quantity no puede superar ${MAX_QUANTITY}` })
  quantity!: number;
}

/** Pago único de la venta. */
export class PaymentInputDto {
  @ApiProperty({
    description:
      'Método de pago. `CASH` exige `cashReceived >= total` y devuelve el vuelto; `CARD` no admite `cashReceived`.',
    enum: PAYMENT_METHODS,
    example: 'CASH',
  })
  @IsIn(PAYMENT_METHODS, {
    message: `method debe ser uno de: ${PAYMENT_METHODS.join(', ')}`,
  })
  method!: PaymentMethodName;

  @ApiPropertyOptional({
    description:
      'Efectivo recibido en COP (máximo dos decimales). **Obligatorio** en `CASH` y nunca menor al total; prohibido en `CARD`.',
    example: 40000,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'cashReceived debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'cashReceived debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'cashReceived supera el máximo permitido' })
  cashReceived?: number;
}

/** Venta a registrar: carrito, descuento global y pago. */
export class CreateSaleDto {
  @ApiProperty({
    description:
      'Productos vendidos: de 1 a 100, sin repetir, con `quantity` entero `>= 1`. El precio y el costo se leen del producto y quedan congelados en la línea.',
    type: () => [SaleItemInputDto],
    minItems: 1,
    maxItems: MAX_SALE_ITEMS,
  })
  @ArrayMinSize(1, { message: 'items debe tener al menos un producto' })
  @ArrayMaxSize(MAX_SALE_ITEMS, {
    message: `items no puede tener más de ${MAX_SALE_ITEMS} productos`,
  })
  @ArrayUnique((item: SaleItemInputDto) => item.productId, {
    message: 'items no puede repetir el mismo producto',
  })
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @ApiPropertyOptional({
    description:
      'Descuento global absoluto en COP (máximo dos decimales). Se prorratea entre las líneas en proporción a su subtotal y el residuo del redondeo se reparte de a un centavo, en orden. No puede superar el subtotal de la venta (`400`).',
    example: 3570,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'discountAmount debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'discountAmount debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'discountAmount supera el máximo permitido' })
  discountAmount?: number;

  @ApiProperty({
    description: 'Pago de la venta (uno solo por venta).',
    type: PaymentInputDto,
    required: true,
  })
  @IsDefined({ message: 'payment es obligatorio' })
  @ValidateNested()
  @Type(() => PaymentInputDto)
  payment!: PaymentInputDto;
}
