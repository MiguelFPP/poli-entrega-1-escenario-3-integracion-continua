import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Filtros y paginación del listado de usuarios. */
export class QueryUsersDto {
  @ApiPropertyOptional({
    description: 'Página solicitada (1-based).',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de usuarios por página.',
    example: 20,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'pageSize debe ser un número entero' })
  @Min(1, { message: 'pageSize debe ser mayor o igual a 1' })
  @Max(MAX_PAGE_SIZE, {
    message: `pageSize no puede superar ${MAX_PAGE_SIZE}`,
  })
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description:
      'Búsqueda parcial (insensible a mayúsculas) sobre nombre y email.',
    example: 'admin',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'search debe ser texto' })
  @MaxLength(100, { message: 'search no puede superar 100 caracteres' })
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filtra por estado de la cuenta (`true` = activos, `false` = inactivos). Se envía como texto en el query string.',
    enum: ['true', 'false'],
    example: 'true',
    type: String,
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'active debe ser "true" o "false"' })
  active?: 'true' | 'false';
}
