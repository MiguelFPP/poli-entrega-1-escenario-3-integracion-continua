import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardRangeDto } from './dto/dashboard-range.dto.js';
import { DashboardLowStockDto } from './dto/dashboard-low-stock.dto.js';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto.js';
import { PaymentMethodsDto } from './dto/payment-methods.dto.js';
import {
  DEFAULT_LOW_STOCK_LIMIT,
  MAX_LOW_STOCK_LIMIT,
  QueryLowStockLimitDto,
} from './dto/query-low-stock-limit.dto.js';
import {
  DEFAULT_TOP_PRODUCTS_LIMIT,
  MAX_TOP_PRODUCTS_LIMIT,
  QueryTopProductsDto,
  TOP_PRODUCT_SORT_FIELDS,
} from './dto/query-top-products.dto.js';
import {
  QueryTrendDto,
  TREND_GRANULARITIES,
} from './dto/query-trend.dto.js';
import { SalesTrendDto } from './dto/sales-trend.dto.js';
import { TopProductsDto } from './dto/top-products.dto.js';

const RANGE_QUERIES = [
  {
    name: 'from',
    required: false,
    description:
      'Fecha inicial inclusive (ISO 8601, UTC). Por defecto, 30 días antes de `to`.',
    type: String,
    example: '2026-02-01T00:00:00.000Z',
  },
  {
    name: 'to',
    required: false,
    description:
      'Fecha final inclusive (ISO 8601, UTC). Por defecto, el momento de la consulta.',
    type: String,
    example: '2026-02-28T23:59:59.999Z',
  },
] as const;

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

/** KPIs y reportes de ventas, inventario y cobros (solo ADMIN). */
@ApiTags('Dashboard')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen de KPIs',
    description: [
      'Indicadores del rango pedido; por defecto, los últimos 30 días',
      '(`to = ahora`, `from = ahora - 30 días`). Solo entran ventas',
      '`COMPLETED`: las anuladas y las de fuera del rango se excluyen.',
      '',
      'Fórmulas (importes en COP, IVA 19% incluido salvo donde se indique):',
      '',
      '- `totalSales = sum(Sale.total)` (IVA incluido, ya sin el descuento).',
      '- `grossSales = sum(Sale.subtotal)` — subtotal **con IVA incluido y antes',
      '  del descuento**.',
      '- `netSales = sum(Sale.total - Sale.taxAmount)` — ventas netas **sin IVA**,',
      '  la base del margen.',
      '- `costOfSales = sum(Sale.costTotal)`.',
      '- `grossProfit = sum(Sale.profit)` — equivale a `netSales - costOfSales`.',
      '- `margin = grossProfit / netSales * 100` (dos decimales; `0` si',
      '  `netSales = 0`).',
      '- `averageTicket = totalSales / transactionCount` (dos decimales; `0` si',
      '  no hay ventas).',
      '- `transactionCount` = número de ventas `COMPLETED` del rango.',
      '- `discounts = sum(Sale.discountAmount)`.',
      '- `shrinkage = sum(abs(quantity) * unitCost)` de los movimientos',
      '  `ADJUSTMENT` con `quantity < 0` del rango (mermas).',
      '- `losses = shrinkage + discounts`.',
      '- `inventoryValue = sum(stock * costPrice)` de los productos activos y no',
      '  eliminados (**sin** filtro de fecha).',
      '- `lowStockCount` (`stock <= minStock`) y `outOfStockCount` (`stock = 0`)',
      '  sobre esos mismos productos.',
      '',
      'Un rango con `from > to` responde `400`. Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery(RANGE_QUERIES[0])
  @ApiQuery(RANGE_QUERIES[1])
  @ApiOkResponse({
    description: 'KPIs del rango y fotografías actuales de inventario.',
    type: DashboardSummaryDto,
  })
  @ApiBadRequestResponse({
    description:
      'Fechas no ISO 8601, `from` mayor que `to` o parámetros desconocidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async summary(
    @Query() query: DashboardRangeDto,
  ): Promise<DashboardSummaryDto> {
    return this.dashboard.summary(query);
  }

  @Get('sales-trend')
  @ApiOperation({
    summary: 'Tendencia de ventas',
    description: [
      'Serie temporal de las ventas `COMPLETED` del rango, agrupadas en la',
      'zona `America/Bogota` (los `createdAt` se guardan en UTC):',
      '',
      '- `day` (por defecto): día local, `YYYY-MM-DD`.',
      '- `week`: lunes de la semana local, `YYYY-MM-DD`.',
      '- `month`: mes local, `YYYY-MM`.',
      '',
      'Cada punto trae `totalSales` (IVA incluido), `netSales` (sin IVA),',
      '`grossProfit` y `transactions`. Los buckets se devuelven en orden',
      'ascendente y los periodos sin ventas no aparecen.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery(RANGE_QUERIES[0])
  @ApiQuery(RANGE_QUERIES[1])
  @ApiQuery({
    name: 'granularity',
    required: false,
    description:
      'Agrupación temporal: `day`, `week` (cae al lunes) o `month`. Por defecto `day`.',
    enum: TREND_GRANULARITIES,
    example: 'day',
  })
  @ApiOkResponse({
    description: 'Serie de ventas por periodo, en orden ascendente.',
    type: SalesTrendDto,
  })
  @ApiBadRequestResponse({
    description:
      '`granularity` inválida, fechas no ISO 8601, `from` mayor que `to` o parámetros desconocidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async salesTrend(@Query() query: QueryTrendDto): Promise<SalesTrendDto> {
    return this.dashboard.salesTrend(query);
  }

  @Get('top-products')
  @ApiOperation({
    summary: 'Top de productos vendidos',
    description: [
      'Agrega las líneas (`SaleItem`) de las ventas `COMPLETED` del rango por',
      '`productId`, usando el snapshot `productName`/`sku` de la línea más',
      'reciente:',
      '',
      '- `quantity = sum(SaleItem.quantity)`.',
      '- `revenue = sum(SaleItem.lineTotal)` (IVA incluido).',
      '- `profit = sum(SaleItem.lineProfit)` (sin IVA).',
      '',
      '`sortBy` (`quantity` por defecto, `revenue` o `profit`) ordena de forma',
      'descendente; el empate se resuelve por nombre y luego por id.',
      '`limit` va de 1 a 50 (por defecto 10).',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery(RANGE_QUERIES[0])
  @ApiQuery(RANGE_QUERIES[1])
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `Productos devueltos (1 a ${MAX_TOP_PRODUCTS_LIMIT}).`,
    type: Number,
    example: DEFAULT_TOP_PRODUCTS_LIMIT,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Métrica de orden descendente.',
    enum: TOP_PRODUCT_SORT_FIELDS,
    example: 'quantity',
  })
  @ApiOkResponse({
    description: 'Productos más vendidos del rango según el criterio pedido.',
    type: TopProductsDto,
  })
  @ApiBadRequestResponse({
    description:
      '`limit` fuera de rango, `sortBy` inválido, fechas no ISO 8601, `from` mayor que `to` o parámetros desconocidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async topProducts(
    @Query() query: QueryTopProductsDto,
  ): Promise<TopProductsDto> {
    return this.dashboard.topProducts(query);
  }

  @Get('payment-methods')
  @ApiOperation({
    summary: 'Cobros por método de pago',
    description: [
      'Agrupa los pagos (`Payment`) de las ventas `COMPLETED` del rango por',
      '`method`: `transactions` cuenta los cobros y `amount` suma',
      '`Payment.amount` (IVA incluido, igual a `totalSales`).',
      '',
      'La respuesta siempre incluye `CASH` y `CARD` en ese orden: los métodos',
      'sin cobros aparecen con `0`. `total` reúne todos los métodos.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery(RANGE_QUERIES[0])
  @ApiQuery(RANGE_QUERIES[1])
  @ApiOkResponse({
    description: 'Distribución de los cobros por método de pago.',
    type: PaymentMethodsDto,
  })
  @ApiBadRequestResponse({
    description:
      'Fechas no ISO 8601, `from` mayor que `to` o parámetros desconocidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async paymentMethods(
    @Query() query: DashboardRangeDto,
  ): Promise<PaymentMethodsDto> {
    return this.dashboard.paymentMethods(query);
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Alertas de stock bajo',
    description: [
      'Productos **activos** y no eliminados con `stock <= minStock`, ordenados',
      'del más crítico al menos (`stock asc, name asc`) y limitados a `limit`',
      '(1 a 100, por defecto 10).',
      '',
      'Cada elemento trae `deficit` (`minStock - stock`, nunca negativo) y su',
      '`unit`. No depende del rango de fechas: es la fotografía actual.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `Productos devueltos (1 a ${MAX_LOW_STOCK_LIMIT}).`,
    type: Number,
    example: DEFAULT_LOW_STOCK_LIMIT,
  })
  @ApiOkResponse({
    description: 'Productos en o bajo el stock mínimo, del más crítico al menos.',
    type: DashboardLowStockDto,
  })
  @ApiBadRequestResponse({
    description: '`limit` fuera de rango o parámetros desconocidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async lowStock(
    @Query() query: QueryLowStockLimitDto,
  ): Promise<DashboardLowStockDto> {
    return this.dashboard.lowStock(query);
  }
}
