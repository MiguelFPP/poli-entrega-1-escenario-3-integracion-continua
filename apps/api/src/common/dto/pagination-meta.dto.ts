import { ApiProperty } from '@nestjs/swagger';

/** Metadatos comunes de cualquier listado paginado. */
export class PaginationMetaDto {
  @ApiProperty({
    description: 'Página actual (1-based).',
    example: 1,
    minimum: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Elementos por página.',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  pageSize!: number;

  @ApiProperty({
    description: 'Total de elementos que cumplen el filtro.',
    example: 3,
    minimum: 0,
  })
  total!: number;

  @ApiProperty({
    description: 'Total de páginas (`0` cuando no hay resultados).',
    example: 1,
    minimum: 0,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Indica si existe una página siguiente.',
    example: false,
  })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'Indica si existe una página anterior.',
    example: false,
  })
  hasPreviousPage!: boolean;
}
