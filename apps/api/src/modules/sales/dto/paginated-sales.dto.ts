import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto.js';
import { SaleSummaryDto } from './sale-response.dto.js';

/** Listado paginado de ventas. */
export class PaginatedSalesDto {
  @ApiProperty({
    description: 'Ventas de la página solicitada (más recientes primero).',
    type: () => [SaleSummaryDto],
  })
  data!: SaleSummaryDto[];

  @ApiProperty({
    description: 'Metadatos de paginación.',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
