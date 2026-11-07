import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import { CreateMovementDto } from './dto/create-movement.dto.js';
import { InventorySummaryDto } from './dto/inventory-summary.dto.js';
import { PaginatedLowStockDto } from './dto/paginated-low-stock.dto.js';
import { PaginatedStockMovementsDto } from './dto/paginated-stock-movements.dto.js';
import { QueryLowStockDto } from './dto/query-low-stock.dto.js';
import { QueryMovementsDto } from './dto/query-movements.dto.js';
import { STOCK_MOVEMENT_TYPES } from './dto/query-product-movements.dto.js';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto.js';
import { InventoryService } from './inventory.service.js';

const PRODUCT_UUID_EXAMPLE = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const CATEGORY_UUID_EXAMPLE = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

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

/** Inventario: movimientos de stock, stock bajo y valorización (solo ADMIN). */
@ApiTags('Inventory')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar movimiento de inventario',
    description: [
      'Registra un movimiento **manual** de stock en una sola transacción:',
      'primero bloquea la fila del producto (`FOR UPDATE`), lee el stock actual',
      'y recalcula el inventario.',
      '',
      '- `type: ENTRY` suma existencias y recalcula el **costo promedio',
      '  ponderado**: `(stock * costoActual + cantidad * unitCost) / stockNuevo`.',
      '  Si el costo resultante cambia, se registra un `PriceHistory` con',
      '  `field: COST` y el usuario autenticado.',
      '- `type: ADJUSTMENT` solo cambia el stock (positivo para sobrantes,',
      '  negativo para mermas) y **no** toca el costo. `reason` es obligatorio.',
      '- `unitCost` solo aplica a `ENTRY` (por defecto el costo del producto).',
      '- Nunca se permite dejar el stock en negativo: responde `409`.',
      '- Los tipos `SALE` y `VOID` los genera el módulo de ventas: aquí',
      '  responden `400`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateMovementDto,
    examples: {
      entradaDeMercancia: {
        summary: 'Entrada de 24 botellas a 1.900 COP',
        value: {
          productId: PRODUCT_UUID_EXAMPLE,
          type: 'ENTRY',
          quantity: 24,
          unitCost: 1900,
          reason: 'Compra a proveedor DistriColombia',
        },
      },
      mermaPorEmpaqueRoto: {
        summary: 'Ajuste negativo de 3 unidades (merma)',
        value: {
          productId: PRODUCT_UUID_EXAMPLE,
          type: 'ADJUSTMENT',
          quantity: -3,
          reason: 'Empaques rotos en bodega',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Movimiento registrado; incluye el resumen del producto y el usuario que lo hizo.',
    type: StockMovementResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Payload inválido, `type` distinto de `ENTRY`/`ADJUSTMENT`, cantidad `0`, `ENTRY` con cantidad negativa o `ADJUSTMENT` sin `reason`.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El producto no existe o fue eliminado lógicamente.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La cantidad dejaría el stock en negativo (`Stock insuficiente`).',
    type: ErrorResponseDto,
  })
  async createMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<StockMovementResponseDto> {
    return this.inventory.createMovement(dto, currentUser.id);
  }

  @Get('movements')
  @ApiOperation({
    summary: 'Listar movimientos de stock',
    description: [
      'Listado paginado de todos los movimientos (entradas, ventas, ajustes y',
      'anulaciones), del más reciente al más antiguo (`createdAt desc, id desc`).',
      '',
      'Filtros:',
      '',
      '- `productId`: UUID del producto.',
      `- \`type\`: ${STOCK_MOVEMENT_TYPES.join(', ')}.`,
      '- `from` / `to`: rango inclusive sobre `createdAt` en ISO 8601.',
      '',
      'Cada movimiento incluye `product` (`id`, `sku`, `name`), `user`',
      '(`id`, `name`, `email`) o `null`, y `saleId` cuando viene de una venta.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
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
    name: 'productId',
    required: false,
    description: 'Filtra por producto.',
    format: 'uuid',
    example: PRODUCT_UUID_EXAMPLE,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filtra por tipo de movimiento.',
    enum: STOCK_MOVEMENT_TYPES,
    example: 'ENTRY',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial inclusive (ISO 8601, UTC).',
    example: '2026-02-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final inclusive (ISO 8601, UTC).',
    example: '2026-02-28T23:59:59.999Z',
  })
  @ApiOkResponse({
    description: 'Página de movimientos y metadatos de paginación.',
    type: PaginatedStockMovementsDto,
  })
  @ApiBadRequestResponse({
    description:
      'Filtros o paginación inválidos (`type`, `productId`, fechas ISO 8601 o `pageSize`).',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async listMovements(
    @Query() query: QueryMovementsDto,
  ): Promise<PaginatedStockMovementsDto> {
    return this.inventory.listMovements(query);
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Listar productos con stock bajo',
    description: [
      'Productos **activos** y no eliminados con `stock <= minStock`, ordenados',
      'del más crítico al menos (`stock asc, name asc`).',
      '',
      'Cada elemento incluye la `category` (`id`, `name`), `deficit`',
      '(`minStock - stock`, nunca negativo), `costPrice` y `inventoryValue`',
      '(`stock * costPrice`).',
      '',
      'Filtros: `categoryId` (UUID) y `search` (parcial e insensible a',
      'mayúsculas sobre nombre, SKU y código de barras).',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
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
    description: 'Productos por página (máximo 100).',
    example: 20,
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filtra por categoría.',
    format: 'uuid',
    example: CATEGORY_UUID_EXAMPLE,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Búsqueda parcial por nombre, SKU o código de barras.',
    example: 'agua',
  })
  @ApiOkResponse({
    description: 'Página de productos en o bajo el stock mínimo.',
    type: PaginatedLowStockDto,
  })
  @ApiBadRequestResponse({
    description: 'Paginación, `categoryId` o `search` inválidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async lowStock(
    @Query() query: QueryLowStockDto,
  ): Promise<PaginatedLowStockDto> {
    return this.inventory.lowStock(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen de inventario',
    description: [
      'Valorización de los productos **activos** y no eliminados:',
      '',
      '- `totalProducts`: cantidad de productos considerados.',
      '- `totalUnits`: suma de unidades en stock.',
      '- `inventoryValue`: `sum(stock * costPrice)` en COP, redondeado a dos',
      '  decimales.',
      '- `lowStockCount`: productos con `stock <= minStock` (incluye agotados).',
      '- `outOfStockCount`: productos con `stock = 0`.',
      '- `generatedAt`: momento del cálculo en ISO 8601.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description:
      'Indicadores de inventario calculados al momento de la consulta.',
    type: InventorySummaryDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async summary(): Promise<InventorySummaryDto> {
    return this.inventory.summary();
  }
}
