import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

/** Importe máximo soportado por `Decimal(14, 2)`. */
const MAX_MONEY = 999_999_999_999.99;

/** Cota de cantidad: evita desbordar el `Int` de `stock`. */
const MAX_QUANTITY = 1_000_000;

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const ADJUSTABLE_MOVEMENT_TYPES = ['ENTRY', 'ADJUSTMENT'] as const;

export type AdjustableMovementType =
  (typeof ADJUSTABLE_MOVEMENT_TYPES)[number];

/** Movimiento manual de inventario: entrada de mercancía o ajuste. */
export class CreateMovementDto {
  @ApiProperty({
    description:
      'Producto afectado (UUID v4). Un producto inexistente o eliminado lógicamente responde `404`.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  @IsUUID('4', { message: 'productId debe ser un UUID v4' })
  productId!: string;

  @ApiProperty({
    description:
      'Tipo de movimiento. Solo `ENTRY` (entrada de mercancía) y `ADJUSTMENT` (ajuste positivo o merma) se registran a mano: `SALE` y `VOID` los genera el módulo de ventas y aquí responden `400`.',
    enum: ADJUSTABLE_MOVEMENT_TYPES,
    example: 'ENTRY',
  })
  @IsIn(ADJUSTABLE_MOVEMENT_TYPES, {
    message: `type debe ser uno de: ${ADJUSTABLE_MOVEMENT_TYPES.join(', ')}`,
  })
  type!: AdjustableMovementType;

  @ApiProperty({
    description:
      'Cantidad entera distinta de cero. En `ENTRY` debe ser mayor que cero; en `ADJUSTMENT` admite valores negativos (merma) y nunca puede dejar el stock en negativo (`409`).',
    example: 24,
    minimum: -MAX_QUANTITY,
    maximum: MAX_QUANTITY,
  })
  @Type(() => Number)
  @IsInt({ message: 'quantity debe ser un número entero' })
  @NotEquals(0, { message: 'quantity debe ser distinto de 0' })
  @Min(-MAX_QUANTITY, {
    message: `quantity no puede ser menor que ${-MAX_QUANTITY}`,
  })
  @Max(MAX_QUANTITY, {
    message: `quantity no puede superar ${MAX_QUANTITY}`,
  })
  quantity!: number;

  @ApiPropertyOptional({
    description:
      'Costo unitario de la entrada en COP (>= 0, máximo dos decimales). Solo aplica a `ENTRY`: si se omite se usa el costo actual del producto. En `ADJUSTMENT` se ignora y se guarda el costo vigente del producto.',
    example: 1900,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'unitCost debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'unitCost debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'unitCost supera el máximo permitido' })
  unitCost?: number;

  @ApiPropertyOptional({
    description:
      'Motivo del movimiento. Opcional en `ENTRY`; **obligatorio** en `ADJUSTMENT` (no puede quedar vacío). Se recorta antes de guardar.',
    example: 'Compra a proveedor DistriColombia',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'reason debe ser texto' })
  @MaxLength(255, { message: 'reason no puede superar 255 caracteres' })
  reason?: string;
}
