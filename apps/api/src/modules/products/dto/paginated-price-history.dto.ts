import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto.js';
import { PriceHistoryResponseDto } from './price-history-response.dto.js';

/** Listado paginado del historial de precios. */
export class PaginatedPriceHistoryDto {
  @ApiProperty({
    description: 'Cambios de precio de la página solicitada (más recientes primero).',
    type: () => [PriceHistoryResponseDto],
  })
  data!: PriceHistoryResponseDto[];

  @ApiProperty({
    description: 'Metadatos de paginación.',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
