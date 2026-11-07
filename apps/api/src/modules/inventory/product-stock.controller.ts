import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { PaginatedStockMovementsDto } from './dto/paginated-stock-movements.dto.js';
import {
  QueryProductMovementsDto,
  STOCK_MOVEMENT_TYPES,
} from './dto/query-product-movements.dto.js';
import { InventoryService } from './inventory.service.js';

const PROTECTED_RESPONSES = {
  unauthorized: {
    description: 'Sin access token válido (cookie `access_token` o Bearer).',
    type: ErrorResponseDto,
  },
  forbidden: {
    description:
      'El usuario autenticado no es `ADMIN` o el `Origin` no es `WEB_ORIGIN`.',
    type: ErrorResponseDto,
  },
} as const;

/** Historial de stock colgado del recurso de productos. */
@ApiTags('Inventory')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('products')
export class ProductStockController {
  constructor(private readonly inventory: InventoryService) {}

  @Get(':id/stock-movements')
  @ApiOperation({
    summary: 'Historial de movimientos de stock de un producto',
    description: [
      'Movimientos del producto paginados y ordenados del más reciente al más',
      'antiguo (`createdAt desc, id desc`).',
      '',
      'Cada movimiento incluye `product` (`id`, `sku`, `name`), `user`',
      '(`id`, `name`, `email`) o `null`, y `saleId` cuando viene de una venta.',
      `\`type\` filtra por ${STOCK_MOVEMENT_TYPES.join(', ')}.`,
      '',
      'Un producto inexistente o eliminado lógicamente responde `404`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID del producto.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página solicitada (1-based).',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Movimientos por página (máximo 100).',
    example: 20,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filtra por tipo de movimiento.',
    enum: STOCK_MOVEMENT_TYPES,
    example: 'ENTRY',
  })
  @ApiOkResponse({
    description: 'Página del historial de stock del producto.',
    type: PaginatedStockMovementsDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no es un UUID válido o la paginación es inválida.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El producto no existe o fue eliminado.',
    type: ErrorResponseDto,
  })
  async listMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryProductMovementsDto,
  ): Promise<PaginatedStockMovementsDto> {
    return this.inventory.productMovements(id, query);
  }
}
