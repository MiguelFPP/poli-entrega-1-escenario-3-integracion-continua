import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAX_MONEY = 999_999_999_999.99;

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeSku = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Actualización parcial del catálogo. **No** incluye `stock`: enviarlo produce
 * `400` porque el inventario se gestiona con movimientos (Fase 4).
 */
export class UpdateProductDto {
  @ApiPropertyOptional({
    description:
      'Nuevo SKU único (se recorta y se guarda en mayúsculas). Un duplicado responde `409`.',
    example: 'BEB-001-A',
    minLength: 2,
    maxLength: 64,
  })
  @Transform(normalizeSku)
  @IsOptional()
  @IsString({ message: 'sku debe ser texto' })
  @MinLength(2, { message: 'sku debe tener al menos 2 caracteres' })
  @MaxLength(64, { message: 'sku no puede superar 64 caracteres' })
  sku?: string;

  @ApiPropertyOptional({
    description:
      'Nuevo código de barras único. Envía `null` para eliminarlo.',
    example: '7701000000028',
    maxLength: 64,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'barcode debe ser texto' })
  @MinLength(4, { message: 'barcode debe tener al menos 4 caracteres' })
  @MaxLength(64, { message: 'barcode no puede superar 64 caracteres' })
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'barcode solo admite letras, números, punto, guion y guion bajo',
  })
  barcode?: string | null;

  @ApiPropertyOptional({
    description: 'Nuevo nombre comercial.',
    example: 'Agua Cristal 600 ml (nueva presentación)',
    minLength: 2,
    maxLength: 160,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(160, { message: 'name no puede superar 160 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripción. Envía `null` para vaciarla.',
    example: 'Agua purificada sin gas, botella de 600 ml',
    maxLength: 500,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'description debe ser texto' })
  @MaxLength(500, { message: 'description no puede superar 500 caracteres' })
  description?: string | null;

  @ApiPropertyOptional({
    description:
      'Nueva categoría existente y **activa**. Una categoría inactiva responde `400`.',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  @IsUUID('4', { message: 'categoryId debe ser un UUID v4' })
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Nuevo costo unitario en COP (>= 0). Si cambia, se registra en el historial de precios con el usuario que hizo el cambio.',
    example: 1300,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'costPrice debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'costPrice debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'costPrice supera el máximo permitido' })
  costPrice?: number;

  @ApiPropertyOptional({
    description:
      'Nuevo precio de venta en COP (>= 0). Si cambia, se registra en el historial de precios con el usuario que hizo el cambio.',
    example: 2200,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'salePrice debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'salePrice debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'salePrice supera el máximo permitido' })
  salePrice?: number;

  @ApiPropertyOptional({
    description: 'Nuevo stock mínimo para alertas de reposición (>= 0).',
    example: 12,
    minimum: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'minStock debe ser un número entero' })
  @Min(0, { message: 'minStock debe ser mayor o igual a 0' })
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Nueva unidad de medida visible.',
    example: 'litro',
    minLength: 1,
    maxLength: 32,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'unit debe ser texto' })
  @MinLength(1, { message: 'unit no puede estar vacío' })
  @MaxLength(32, { message: 'unit no puede superar 32 caracteres' })
  unit?: string;

  @ApiPropertyOptional({
    description:
      'Nueva URL de imagen (solo `http` o `https`). Envía `null` para quitarla.',
    example: 'https://cdn.pos.local/products/agua-cristal-600ml.png',
    maxLength: 500,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'imageUrl debe ser texto' })
  @MaxLength(500, { message: 'imageUrl no puede superar 500 caracteres' })
  @Matches(/^https?:\/\/\S+$/i, {
    message: 'imageUrl debe ser una URL http o https',
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'Activa o desactiva el producto. Para el borrado lógico definitivo usa `DELETE`.',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
