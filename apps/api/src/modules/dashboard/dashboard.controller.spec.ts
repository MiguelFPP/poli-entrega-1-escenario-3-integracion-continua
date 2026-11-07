import { describe, expect, it, jest } from '@jest/globals';
import { DashboardController } from './dashboard.controller.js';
import type { DashboardService } from './dashboard.service.js';
import type { DashboardLowStockDto } from './dto/dashboard-low-stock.dto.js';
import type { DashboardRangeDto } from './dto/dashboard-range.dto.js';
import type { DashboardSummaryDto } from './dto/dashboard-summary.dto.js';
import type { PaymentMethodsDto } from './dto/payment-methods.dto.js';
import type { QueryLowStockLimitDto } from './dto/query-low-stock-limit.dto.js';
import type { QueryTopProductsDto } from './dto/query-top-products.dto.js';
import type { QueryTrendDto } from './dto/query-trend.dto.js';
import type { SalesTrendDto } from './dto/sales-trend.dto.js';
import type { TopProductsDto } from './dto/top-products.dto.js';

const RANGE: DashboardRangeDto = {
  from: '2026-02-01T00:00:00.000Z',
  to: '2026-02-28T23:59:59.999Z',
};

const SUMMARY = { transactionCount: 4 } as unknown as DashboardSummaryDto;
const TREND = { granularity: 'day', data: [] } as unknown as SalesTrendDto;
const TOP = { sortBy: 'quantity', data: [] } as unknown as TopProductsDto;
const PAYMENTS = { data: [], total: { transactions: 0, amount: 0 } } as unknown as PaymentMethodsDto;
const LOW_STOCK = { data: [] } as unknown as DashboardLowStockDto;

function createController() {
  const summary =
    jest.fn<(query: DashboardRangeDto) => Promise<DashboardSummaryDto>>();
  const salesTrend =
    jest.fn<(query: QueryTrendDto) => Promise<SalesTrendDto>>();
  const topProducts =
    jest.fn<(query: QueryTopProductsDto) => Promise<TopProductsDto>>();
  const paymentMethods =
    jest.fn<(query: DashboardRangeDto) => Promise<PaymentMethodsDto>>();
  const lowStock =
    jest.fn<(query: QueryLowStockLimitDto) => Promise<DashboardLowStockDto>>();

  const dashboard = {
    summary,
    salesTrend,
    topProducts,
    paymentMethods,
    lowStock,
  } as unknown as DashboardService;

  return {
    controller: new DashboardController(dashboard),
    summary,
    salesTrend,
    topProducts,
    paymentMethods,
    lowStock,
  };
}

describe('DashboardController', () => {
  it('devuelve el resumen de KPIs', async () => {
    const { controller, summary } = createController();
    summary.mockResolvedValue(SUMMARY);

    const result = await controller.summary(RANGE);

    expect(summary).toHaveBeenCalledWith(RANGE);
    expect(result).toBe(SUMMARY);
  });

  it('devuelve la tendencia de ventas', async () => {
    const { controller, salesTrend } = createController();
    const query: QueryTrendDto = { ...RANGE, granularity: 'week' };
    salesTrend.mockResolvedValue(TREND);

    const result = await controller.salesTrend(query);

    expect(salesTrend).toHaveBeenCalledWith(query);
    expect(result).toBe(TREND);
  });

  it('devuelve el top de productos', async () => {
    const { controller, topProducts } = createController();
    const query: QueryTopProductsDto = {
      ...RANGE,
      limit: 5,
      sortBy: 'revenue',
    };
    topProducts.mockResolvedValue(TOP);

    const result = await controller.topProducts(query);

    expect(topProducts).toHaveBeenCalledWith(query);
    expect(result).toBe(TOP);
  });

  it('devuelve los cobros por método de pago', async () => {
    const { controller, paymentMethods } = createController();
    paymentMethods.mockResolvedValue(PAYMENTS);

    const result = await controller.paymentMethods(RANGE);

    expect(paymentMethods).toHaveBeenCalledWith(RANGE);
    expect(result).toBe(PAYMENTS);
  });

  it('devuelve las alertas de stock bajo', async () => {
    const { controller, lowStock } = createController();
    const query: QueryLowStockLimitDto = { limit: 10 };
    lowStock.mockResolvedValue(LOW_STOCK);

    const result = await controller.lowStock(query);

    expect(lowStock).toHaveBeenCalledWith(query);
    expect(result).toBe(LOW_STOCK);
  });
});
