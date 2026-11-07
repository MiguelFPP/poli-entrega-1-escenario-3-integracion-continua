import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Filtros del listado de categorías. */
export class QueryCategoriesDto {
  @ApiPropertyOptional({
    description:
      'Filtra por estado (`true` = activas, `false` = inactivas). Se envía como texto en el query string.',
    enum: ['true', 'false'],
    example: 'true',
    type: String,
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'active debe ser "true" o "false"' })
  active?: 'true' | 'false';

  @ApiPropertyOptional({
    description:
      'Búsqueda parcial (insensible a mayúsculas) sobre el nombre de la categoría.',
    example: 'beb',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'search debe ser texto' })
  @MaxLength(100, { message: 'search no puede superar 100 caracteres' })
  search?: string;
}
