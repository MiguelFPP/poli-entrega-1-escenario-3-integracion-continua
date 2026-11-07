import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Normaliza el nombre: recorta espacios al inicio y al final. */
const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Alta de una categoría del catálogo. */
export class CreateCategoryDto {
  @ApiProperty({
    description:
      'Nombre único de la categoría (se compara sin distinguir mayúsculas y se recorta).',
    example: 'Bebidas',
    minLength: 2,
    maxLength: 80,
  })
  @Transform(trimString)
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(80, { message: 'name no puede superar 80 caracteres' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional de la categoría.',
    example: 'Bebidas frías y calientes',
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
      'Estado inicial de la categoría. Por defecto `true` (activa).',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
