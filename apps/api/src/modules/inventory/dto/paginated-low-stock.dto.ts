import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto.js';
import { LowStockItemDto } from './low-stock-item.dto.js';

/** Listado paginado de productos en o bajo el stock mínimo. */
export class PaginatedLowStockDto {
  @ApiProperty({
    description: 'Productos críticos de la página (stock más bajo primero).',
    type: () => [LowStockItemDto],
  })
  data!: LowStockItemDto[];

  @ApiProperty({
    description: 'Metadatos de paginación.',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
