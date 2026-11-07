import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/** Importe máximo soportado por `Decimal(14, 2)`. */
const MAX_MONEY = 999_999_999_999.99;

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeSku = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Alta de un producto del catálogo. El stock inicial siempre es `0`. */
export class CreateProductDto {
  @ApiProperty({
    description:
      'SKU único. Se recorta y se guarda en mayúsculas; un duplicado responde `409`.',
    example: 'BEB-001',
    minLength: 2,
    maxLength: 64,
  })
  @Transform(normalizeSku)
  @IsString({ message: 'sku debe ser texto' })
  @MinLength(2, { message: 'sku debe tener al menos 2 caracteres' })
  @MaxLength(64, { message: 'sku no puede superar 64 caracteres' })
  sku!: string;

  @ApiPropertyOptional({
    description:
      'Código de barras opcional y único. Se recorta; envía `null` si no aplica.',
    example: '7701000000011',
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

  @ApiProperty({
    description: 'Nombre comercial del producto.',
    example: 'Agua Cristal 600 ml',
    minLength: 2,
    maxLength: 160,
  })
  @Transform(trimString)
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(160, { message: 'name no puede superar 160 caracteres' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional del producto.',
    example: 'Agua purificada sin gas, botella de 600 ml',
    maxLength: 500,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'description debe ser texto' })
  @MaxLength(500, { message: 'description no puede superar 500 caracteres' })
  description?: string | null;

  @ApiProperty({
    description:
      'Categoría existente y **activa**. Una categoría inexistente o inactiva responde `400`.',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  @IsUUID('4', { message: 'categoryId debe ser un UUID v4' })
  categoryId!: string;

  @ApiProperty({
    description: 'Costo unitario en COP (>= 0, dos decimales).',
    example: 1200,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'costPrice debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'costPrice debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'costPrice supera el máximo permitido' })
  costPrice!: number;

  @ApiProperty({
    description: 'Precio de venta en COP (>= 0, dos decimales).',
    example: 2000,
    minimum: 0,
    maximum: MAX_MONEY,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'salePrice debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'salePrice debe ser mayor o igual a 0' })
  @Max(MAX_MONEY, { message: 'salePrice supera el máximo permitido' })
  salePrice!: number;

  @ApiPropertyOptional({
    description:
      'Stock mínimo para alertas de reposición (>= 0). El stock real no se edita aquí: inicia en `0` y lo gestionan los movimientos de inventario.',
    example: 24,
    minimum: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'minStock debe ser un número entero' })
  @Min(0, { message: 'minStock debe ser mayor o igual a 0' })
  minStock: number = 0;

  @ApiPropertyOptional({
    description: 'Unidad de medida visible (por defecto `unidad`).',
    example: 'botella',
    minLength: 1,
    maxLength: 32,
    default: 'unidad',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'unit debe ser texto' })
  @MinLength(1, { message: 'unit no puede estar vacío' })
  @MaxLength(32, { message: 'unit no puede superar 32 caracteres' })
  unit: string = 'unidad';

  @ApiPropertyOptional({
    description:
      'URL de la imagen del producto (solo `http` o `https`). Ejemplo de CDN o almacenamiento propio.',
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
      'Estado inicial del producto. Por defecto `true` (activo y visible en el catálogo).',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
