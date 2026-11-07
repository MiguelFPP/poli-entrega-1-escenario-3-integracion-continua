import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Actualización parcial de una categoría; al menos un campo es obligatorio. */
export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description:
      'Nuevo nombre único (sin distinguir mayúsculas); se recorta. Un duplicado responde `409`.',
    example: 'Bebidas y jugos',
    minLength: 2,
    maxLength: 80,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(80, { message: 'name no puede superar 80 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripción. Envía `null` para vaciarla.',
    example: 'Bebidas frías, calientes y jugos naturales',
    maxLength: 255,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'description debe ser texto' })
  @MaxLength(255, { message: 'description no puede superar 255 caracteres' })
  description?: string | null;

  @ApiPropertyOptional({
    description:
      'Activa o desactiva la categoría. Una categoría inactiva no admite productos nuevos.',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
