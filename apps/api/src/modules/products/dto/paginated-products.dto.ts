import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto.js';
import { ProductResponseDto } from './product-response.dto.js';

/** Listado paginado de productos. */
export class PaginatedProductsDto {
  @ApiProperty({
    description: 'Productos de la página solicitada.',
    type: () => [ProductResponseDto],
  })
  data!: ProductResponseDto[];

  @ApiProperty({
    description: 'Metadatos de paginación.',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
