import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  type Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  averageTicket,
  bogotaPeriod,
  fromCents,
  marginPercent,
  PAYMENT_METHOD_ORDER,
  sumInventory,
  sumSaleTotals,
  sumShrinkageCents,
  toCents,
  toDashboardLowStockItemDto,
  toPaymentMethodBreakdownDto,
  toRangeResponse,
  toSalesTrendPointDto,
  toTopProductItemDto,
  type PaymentMethodAggregateCents,
  type SalesTrendBucketCents,
  type TopProductAggregateCents,
} from './dashboard.mapper.js';
import type { DashboardRangeDto } from './dto/dashboard-range.dto.js';
import type { DashboardLowStockDto } from './dto/dashboard-low-stock.dto.js';
import type { DashboardSummaryDto } from './dto/dashboard-summary.dto.js';
import type { PaymentMethodsDto } from './dto/payment-methods.dto.js';
import type { QueryLowStockLimitDto } from './dto/query-low-stock-limit.dto.js';
import type {
  QueryTopProductsDto,
  TopProductSortField,
} from './dto/query-top-products.dto.js';
import type { QueryTrendDto } from './dto/query-trend.dto.js';
import type { SalesTrendDto } from './dto/sales-trend.dto.js';
import type { TopProductsDto } from './dto/top-products.dto.js';

const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

const INVALID_DATE = 'debe ser una fecha ISO 8601 válida';
const INVALID_RANGE = 'from no puede ser mayor que to';

/** Totales de cada venta del rango, para agregarlos en centavos. */
const SALE_TOTALS_SELECT = {
  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  total: true,
  costTotal: true,
  profit: true,
} as const satisfies Prisma.SaleSelect;

/** Ventas del rango con su fecha, para agrupar la tendencia. */
const TREND_SALE_SELECT = {
  createdAt: true,
  total: true,
  taxAmount: true,
  profit: true,
} as const satisfies Prisma.SaleSelect;

/** Snapshot de la línea: el producto puede cambiar después de la venta. */
const TOP_PRODUCT_ITEM_SELECT = {
  productId: true,
  productName: true,
  sku: true,
  quantity: true,
  lineTotal: true,
  lineProfit: true,
} as const satisfies Prisma.SaleItemSelect;

const SHRINKAGE_SELECT = {
  quantity: true,
  unitCost: true,
} as const satisfies Prisma.StockMovementSelect;

const INVENTORY_SELECT = {
  stock: true,
  minStock: true,
  costPrice: true,
} as const satisfies Prisma.ProductSelect;

const LOW_STOCK_SELECT = {
  id: true,
  sku: true,
  name: true,
  stock: true,
  minStock: true,
  unit: true,
} as const satisfies Prisma.ProductSelect;

type DashboardDateRange = { readonly from: Date; readonly to: Date };

/** Convierte un texto ISO 8601 a `Date`, rechazando valores inválidos. */
function parseIsoDate(
  value: string | undefined,
  field: string,
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} ${INVALID_DATE}`);
  }

  return date;
}

/** Rango efectivo del reporte: por defecto, los últimos 30 días. */
function resolveRange(query: DashboardRangeDto): DashboardDateRange {
  const to = parseIsoDate(query.to, 'to') ?? new Date();
  const from =
    parseIsoDate(query.from, 'from') ??
    new Date(to.getTime() - DEFAULT_RANGE_DAYS * MS_PER_DAY);

  if (from.getTime() > to.getTime()) {
    throw new BadRequestException(INVALID_RANGE);
  }

  return { from, to };
}

/** Filtro común: solo ventas `COMPLETED` con `createdAt` dentro del rango. */
function completedSalesWhere(
  range: DashboardDateRange,
): Prisma.SaleWhereInput {
  return {
    status: SaleStatus.COMPLETED,
    createdAt: { gte: range.from, lte: range.to },
  };
}

/** Orden descendente por la métrica pedida, con empate por nombre e id. */
function compareTopProducts(
  left: TopProductAggregateCents,
  right: TopProductAggregateCents,
  sortBy: TopProductSortField,
): number {
  const metric = sortBy === 'revenue'
    ? right.revenue - left.revenue
    : sortBy === 'profit'
      ? right.profit - left.profit
      : right.quantity - left.quantity;

  if (metric !== 0) {
    return metric;
  }

  const byName = left.name.localeCompare(right.name);

  return byName !== 0 ? byName : left.productId.localeCompare(right.productId);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** KPIs del rango: ventas, pérdidas e inventario actual. */
  async summary(query: DashboardRangeDto): Promise<DashboardSummaryDto> {
    const range = resolveRange(query);
    const [sales, movements, products] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: completedSalesWhere(range),
        select: SALE_TOTALS_SELECT,
      }),
      this.prisma.stockMovement.findMany({
        where: {
          type: StockMovementType.ADJUSTMENT,
          quantity: { lt: 0 },
          createdAt: { gte: range.from, lte: range.to },
        },
        select: SHRINKAGE_SELECT,
      }),
      this.prisma.product.findMany({
        where: { active: true, deletedAt: null },
        select: INVENTORY_SELECT,
      }),
    ]);
    const totals = sumSaleTotals(sales);
    const shrinkageCents = sumShrinkageCents(movements);
    const inventory = sumInventory(products);

    return {
      range: toRangeResponse(range.from, range.to),
      totalSales: fromCents(totals.totalSales),
      grossSales: fromCents(totals.grossSales),
      netSales: fromCents(totals.netSales),
      costOfSales: fromCents(totals.costOfSales),
      grossProfit: fromCents(totals.grossProfit),
      margin: marginPercent(totals.netSales, totals.grossProfit),
      averageTicket: averageTicket(
        totals.totalSales,
        totals.transactionCount,
      ),
      transactionCount: totals.transactionCount,
      discounts: fromCents(totals.discounts),
      shrinkage: fromCents(shrinkageCents),
      losses: fromCents(shrinkageCents + totals.discounts),
      inventoryValue: fromCents(inventory.inventoryValue),
      lowStockCount: inventory.lowStockCount,
      outOfStockCount: inventory.outOfStockCount,
    };
  }

  /** Tendencia de ventas agrupada en la zona `America/Bogota`. */
  async salesTrend(query: QueryTrendDto): Promise<SalesTrendDto> {
    const range = resolveRange(query);
    const sales = await this.prisma.sale.findMany({
      where: completedSalesWhere(range),
      select: TREND_SALE_SELECT,
    });
    const buckets = new Map<string, SalesTrendBucketCents>();

    for (const sale of sales) {
      const period = bogotaPeriod(sale.createdAt, query.granularity);
      const bucket = buckets.get(period) ?? {
        totalSales: 0,
        netSales: 0,
        grossProfit: 0,
        transactions: 0,
      };
      const total = toCents(sale.total.toNumber());

      bucket.totalSales += total;
      bucket.netSales += total - toCents(sale.taxAmount.toNumber());
      bucket.grossProfit += toCents(sale.profit.toNumber());
      bucket.transactions += 1;
      buckets.set(period, bucket);
    }

    const data = [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([period, bucket]) => toSalesTrendPointDto(period, bucket));

    return {
      range: toRangeResponse(range.from, range.to),
      granularity: query.granularity,
      data,
    };
  }

  /** Productos más vendidos del rango según la métrica solicitada. */
  async topProducts(query: QueryTopProductsDto): Promise<TopProductsDto> {
    const range = resolveRange(query);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: completedSalesWhere(range) },
      select: TOP_PRODUCT_ITEM_SELECT,
      orderBy: [{ sale: { createdAt: 'asc' } }, { id: 'asc' }],
    });
    const aggregates = new Map<string, TopProductAggregateCents>();

    for (const item of items) {
      const aggregate = aggregates.get(item.productId) ?? {
        productId: item.productId,
        name: item.productName,
        sku: item.sku,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };

      // El snapshot más reciente del rango fija el nombre y el SKU mostrados.
      aggregate.name = item.productName;
      aggregate.sku = item.sku;
      aggregate.quantity += item.quantity;
      aggregate.revenue += toCents(item.lineTotal.toNumber());
      aggregate.profit += toCents(item.lineProfit.toNumber());
      aggregates.set(item.productId, aggregate);
    }

    const data = [...aggregates.values()]
      .sort((left, right) => compareTopProducts(left, right, query.sortBy))
      .slice(0, query.limit)
      .map(toTopProductItemDto);

    return {
      range: toRangeResponse(range.from, range.to),
      sortBy: query.sortBy,
      data,
    };
  }

  /** Cobros por método de pago de las ventas vigentes del rango. */
  async paymentMethods(query: DashboardRangeDto): Promise<PaymentMethodsDto> {
    const range = resolveRange(query);
    const payments = await this.prisma.payment.findMany({
      where: { sale: completedSalesWhere(range) },
      select: { method: true, amount: true },
    });
    const aggregates = new Map<PaymentMethod, PaymentMethodAggregateCents>();

    for (const method of PAYMENT_METHOD_ORDER) {
      aggregates.set(method, { transactions: 0, amount: 0 });
    }

    for (const payment of payments) {
      const aggregate = aggregates.get(payment.method) ?? {
        transactions: 0,
        amount: 0,
      };

      aggregate.transactions += 1;
      aggregate.amount += toCents(payment.amount.toNumber());
      aggregates.set(payment.method, aggregate);
    }

    const data = PAYMENT_METHOD_ORDER.map((method) =>
      toPaymentMethodBreakdownDto(
        method,
        aggregates.get(method) ?? { transactions: 0, amount: 0 },
      ),
    );
    const transactions = PAYMENT_METHOD_ORDER.reduce(
      (acc, method) => acc + (aggregates.get(method)?.transactions ?? 0),
      0,
    );
    const amountCents = PAYMENT_METHOD_ORDER.reduce(
      (acc, method) => acc + (aggregates.get(method)?.amount ?? 0),
      0,
    );

    return {
      range: toRangeResponse(range.from, range.to),
      data,
      total: { transactions, amount: fromCents(amountCents) },
    };
  }

  /** Productos activos con `stock <= minStock`, del más crítico al menos. */
  async lowStock(query: QueryLowStockLimitDto): Promise<DashboardLowStockDto> {
    const products = await this.prisma.product.findMany({
      where: {
        active: true,
        deletedAt: null,
        stock: { lte: this.prisma.product.fields.minStock },
      },
      select: LOW_STOCK_SELECT,
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take: query.limit,
    });

    return { data: products.map(toDashboardLowStockItemDto) };
  }
}
