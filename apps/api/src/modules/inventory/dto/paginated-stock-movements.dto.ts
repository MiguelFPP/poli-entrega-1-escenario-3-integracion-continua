import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto.js';
import { StockMovementResponseDto } from './stock-movement-response.dto.js';

/** Listado paginado de movimientos de stock. */
export class PaginatedStockMovementsDto {
  @ApiProperty({
    description: 'Movimientos de la página solicitada (más recientes primero).',
    type: () => [StockMovementResponseDto],
  })
  data!: StockMovementResponseDto[];

  @ApiProperty({
    description: 'Metadatos de paginación.',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
