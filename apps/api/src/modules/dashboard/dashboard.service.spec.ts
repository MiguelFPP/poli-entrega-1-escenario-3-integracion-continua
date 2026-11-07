import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  SaleStatus,
  StockMovementType,
} from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { DashboardService } from './dashboard.service.js';
import type { DashboardRangeDto } from './dto/dashboard-range.dto.js';
import type { QueryTopProductsDto } from './dto/query-top-products.dto.js';
import type { QueryTrendDto } from './dto/query-trend.dto.js';

const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const SECOND_PRODUCT_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const THIRD_PRODUCT_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';

const RANGE = {
  from: '2026-02-01T00:00:00.000Z',
  to: '2026-02-28T23:59:59.999Z',
} as const;

const THIRTY_DAYS_MS = 30 * 86_400_000;

type FindManyArgs = {
  where?: unknown;
  select?: unknown;
  orderBy?: unknown;
  take?: number;
};

type SaleRow = {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  costTotal: Prisma.Decimal;
  profit: Prisma.Decimal;
};

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    subtotal: new Prisma.Decimal(0),
    discountAmount: new Prisma.Decimal(0),
    taxAmount: new Prisma.Decimal(0),
    total: new Prisma.Decimal(0),
    costTotal: new Prisma.Decimal(0),
    profit: new Prisma.Decimal(0),
    ...overrides,
  };
}

type TrendRow = {
  createdAt: Date;
  total: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  profit: Prisma.Decimal;
};

type TopItemRow = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  lineTotal: Prisma.Decimal;
  lineProfit: Prisma.Decimal;
};

function trendRow(
  createdAt: string,
  total: number,
  taxAmount: number,
  profit: number,
): TrendRow {
  return {
    createdAt: new Date(createdAt),
    total: new Prisma.Decimal(total),
    taxAmount: new Prisma.Decimal(taxAmount),
    profit: new Prisma.Decimal(profit),
  };
}

function itemRow(overrides: Partial<TopItemRow> = {}): TopItemRow {
  return {
    productId: PRODUCT_ID,
    productName: 'Agua Cristal 600 ml',
    sku: 'BEB-001',
    quantity: 1,
    lineTotal: new Prisma.Decimal(10000),
    lineProfit: new Prisma.Decimal(2000),
    ...overrides,
  };
}

function createMocks() {
  const saleFindMany =
    jest.fn<(args: FindManyArgs) => Promise<unknown[]>>();
  const movementFindMany =
    jest.fn<(args: FindManyArgs) => Promise<unknown[]>>();
  const productFindMany =
    jest.fn<(args: FindManyArgs) => Promise<unknown[]>>();
  const saleItemFindMany =
    jest.fn<(args: FindManyArgs) => Promise<unknown[]>>();
  const paymentFindMany =
    jest.fn<(args: FindManyArgs) => Promise<unknown[]>>();

  const minStockField = { $field: 'product.minStock' };

  const rawPrisma = {
    sale: { findMany: saleFindMany },
    stockMovement: { findMany: movementFindMany },
    product: {
      findMany: productFindMany,
      fields: { minStock: minStockField },
    },
    saleItem: { findMany: saleItemFindMany },
    payment: { findMany: paymentFindMany },
    $transaction: jest.fn(),
  };

  rawPrisma.$transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(rawPrisma);
    }

    return Promise.all(arg as Promise<unknown>[]);
  }) as unknown as typeof rawPrisma.$transaction;

  const prisma = rawPrisma as unknown as PrismaService;

  return {
    service: new DashboardService(prisma),
    saleFindMany,
    movementFindMany,
    productFindMany,
    saleItemFindMany,
    paymentFindMany,
    minStockField,
  };
}

describe('DashboardService', () => {
  describe('summary', () => {
    it('agrega los KPIs del rango y valoriza el inventario actual', async () => {
      const { service, saleFindMany, movementFindMany, productFindMany } =
        createMocks();

      saleFindMany.mockResolvedValue([
        saleRow({
          subtotal: new Prisma.Decimal(20000),
          discountAmount: new Prisma.Decimal(2000),
          taxAmount: new Prisma.Decimal(2873.95),
          total: new Prisma.Decimal(18000),
          costTotal: new Prisma.Decimal(12000),
          profit: new Prisma.Decimal(3126.05),
        }),
        saleRow({
          subtotal: new Prisma.Decimal(15700),
          taxAmount: new Prisma.Decimal(2506.72),
          total: new Prisma.Decimal(15700),
          costTotal: new Prisma.Decimal(11000),
          profit: new Prisma.Decimal(2193.28),
        }),
      ]);
      movementFindMany.mockResolvedValue([
        { quantity: -3, unitCost: new Prisma.Decimal(1200) },
        { quantity: -2, unitCost: new Prisma.Decimal(1500) },
      ]);
      productFindMany.mockResolvedValue([
        { stock: 10, minStock: 24, costPrice: new Prisma.Decimal(1000) },
        { stock: 0, minStock: 5, costPrice: new Prisma.Decimal(2000) },
        { stock: 40, minStock: 5, costPrice: new Prisma.Decimal(500) },
      ]);

      const result = await service.summary({ ...RANGE });

      expect(saleFindMany.mock.calls[0]?.[0].where).toMatchObject({
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: new Date(RANGE.from),
          lte: new Date(RANGE.to),
        },
      });
      expect(movementFindMany.mock.calls[0]?.[0].where).toMatchObject({
        type: StockMovementType.ADJUSTMENT,
        quantity: { lt: 0 },
        createdAt: {
          gte: new Date(RANGE.from),
          lte: new Date(RANGE.to),
        },
      });
      expect(productFindMany.mock.calls[0]?.[0].where).toMatchObject({
        active: true,
        deletedAt: null,
      });

      expect(result).toEqual({
        range: { from: RANGE.from, to: RANGE.to },
        totalSales: 33700,
        grossSales: 35700,
        netSales: 28319.33,
        costOfSales: 23000,
        grossProfit: 5319.33,
        margin: 18.78,
        averageTicket: 16850,
        transactionCount: 2,
        discounts: 2000,
        shrinkage: 6600,
        losses: 8600,
        inventoryValue: 30000,
        lowStockCount: 2,
        outOfStockCount: 1,
      });
    });

    it('usa por defecto los últimos 30 días y devuelve ceros sin ventas', async () => {
      const { service, saleFindMany, movementFindMany, productFindMany } =
        createMocks();

      saleFindMany.mockResolvedValue([]);
      movementFindMany.mockResolvedValue([]);
      productFindMany.mockResolvedValue([]);

      const result = await service.summary({});
      const from = new Date(result.range.from);
      const to = new Date(result.range.to);

      expect(to.getTime() - from.getTime()).toBe(THIRTY_DAYS_MS);
      expect(saleFindMany.mock.calls[0]?.[0].where).toMatchObject({
        createdAt: { gte: from, lte: to },
      });
      expect(result).toEqual({
        range: { from: from.toISOString(), to: to.toISOString() },
        totalSales: 0,
        grossSales: 0,
        netSales: 0,
        costOfSales: 0,
        grossProfit: 0,
        margin: 0,
        averageTicket: 0,
        transactionCount: 0,
        discounts: 0,
        shrinkage: 0,
        losses: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      });
    });

    it('rechaza un rango con from posterior a to', async () => {
      const { service, saleFindMany } = createMocks();

      await expect(
        service.summary({
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-02-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(saleFindMany).not.toHaveBeenCalled();
    });

    it('rechaza una fecha de rango que no es ISO 8601', async () => {
      const { service, saleFindMany } = createMocks();

      await expect(
        service.summary({ from: 'ayer' } as DashboardRangeDto),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(saleFindMany).not.toHaveBeenCalled();
    });
  });

  describe('salesTrend', () => {
    it('agrupa la tendencia diaria en la zona America/Bogota', async () => {
      const { service, saleFindMany } = createMocks();

      saleFindMany.mockResolvedValue([
        trendRow('2026-02-01T02:00:00.000Z', 10000, 1596.64, 3000),
        trendRow('2026-02-01T13:00:00.000Z', 20000, 3193.28, 6000),
        trendRow('2026-02-02T03:30:00.000Z', 5000, 798.32, 1500),
      ]);

      const result = await service.salesTrend({
        ...RANGE,
        granularity: 'day',
      } as QueryTrendDto);

      expect(result.granularity).toBe('day');
      expect(result.range).toEqual({ from: RANGE.from, to: RANGE.to });
      expect(result.data).toEqual([
        {
          period: '2026-01-31',
          totalSales: 10000,
          netSales: 8403.36,
          grossProfit: 3000,
          transactions: 1,
        },
        {
          period: '2026-02-01',
          totalSales: 25000,
          netSales: 21008.4,
          grossProfit: 7500,
          transactions: 2,
        },
      ]);
    });

    it('agrupa la tendencia por mes y por semana local', async () => {
      const { service, saleFindMany } = createMocks();

      saleFindMany.mockResolvedValue([
        trendRow('2026-02-01T15:00:00.000Z', 10000, 1596.64, 3000),
        trendRow('2026-02-05T15:00:00.000Z', 20000, 3193.28, 6000),
        trendRow('2026-03-01T15:00:00.000Z', 5000, 798.32, 1500),
      ]);

      const monthly = await service.salesTrend({
        ...RANGE,
        granularity: 'month',
      } as QueryTrendDto);

      expect(monthly.data.map((point) => point.period)).toEqual([
        '2026-02',
        '2026-03',
      ]);
      expect(monthly.data[0]).toMatchObject({
        totalSales: 30000,
        transactions: 2,
      });

      const weekly = await service.salesTrend({
        ...RANGE,
        granularity: 'week',
      } as QueryTrendDto);

      // Las fechas caen en las semanas del lunes 26-01, 02-02 y 23-02.
      expect(weekly.data).toEqual([
        {
          period: '2026-01-26',
          totalSales: 10000,
          netSales: 8403.36,
          grossProfit: 3000,
          transactions: 1,
        },
        {
          period: '2026-02-02',
          totalSales: 20000,
          netSales: 16806.72,
          grossProfit: 6000,
          transactions: 1,
        },
        {
          period: '2026-02-23',
          totalSales: 5000,
          netSales: 4201.68,
          grossProfit: 1500,
          transactions: 1,
        },
      ]);
    });

    it('no devuelve buckets vacíos cuando no hay ventas', async () => {
      const { service, saleFindMany } = createMocks();

      saleFindMany.mockResolvedValue([]);

      const result = await service.salesTrend({
        ...RANGE,
        granularity: 'day',
      } as QueryTrendDto);

      expect(result.data).toEqual([]);
      expect(saleFindMany.mock.calls[0]?.[0].where).toMatchObject({
        status: SaleStatus.COMPLETED,
      });
    });
  });

  describe('topProducts', () => {
    it('ordena por la métrica pedida y aplica el límite', async () => {
      const { service, saleItemFindMany } = createMocks();

      saleItemFindMany.mockResolvedValue([
        itemRow({
          productId: PRODUCT_ID,
          productName: 'Agua Cristal 600 ml',
          sku: 'BEB-001',
          quantity: 6,
          lineTotal: new Prisma.Decimal(58000),
          lineProfit: new Prisma.Decimal(9739.49),
        }),
        itemRow({
          productId: SECOND_PRODUCT_ID,
          productName: 'Gaseosa 400 ml',
          sku: 'BEB-002',
          quantity: 2,
          lineTotal: new Prisma.Decimal(89000),
          lineProfit: new Prisma.Decimal(14789.92),
        }),
        itemRow({
          productId: THIRD_PRODUCT_ID,
          productName: 'Papas Margarita Pollo 105 g',
          sku: 'SNK-001',
          quantity: 8,
          lineTotal: new Prisma.Decimal(32000),
          lineProfit: new Prisma.Decimal(12490.76),
        }),
      ]);

      const byQuantity = await service.topProducts({
        ...RANGE,
        limit: 10,
        sortBy: 'quantity',
      } as QueryTopProductsDto);

      expect(byQuantity.sortBy).toBe('quantity');
      expect(byQuantity.data.map((item) => item.sku)).toEqual([
        'SNK-001',
        'BEB-001',
        'BEB-002',
      ]);

      const byRevenue = await service.topProducts({
        ...RANGE,
        limit: 2,
        sortBy: 'revenue',
      } as QueryTopProductsDto);

      expect(byRevenue.data.map((item) => item.sku)).toEqual([
        'BEB-002',
        'BEB-001',
      ]);
      expect(byRevenue.data[0]).toEqual({
        productId: SECOND_PRODUCT_ID,
        name: 'Gaseosa 400 ml',
        sku: 'BEB-002',
        quantity: 2,
        revenue: 89000,
        profit: 14789.92,
      });

      const byProfit = await service.topProducts({
        ...RANGE,
        limit: 1,
        sortBy: 'profit',
      } as QueryTopProductsDto);

      expect(byProfit.data.map((item) => item.sku)).toEqual(['BEB-002']);
      expect(byProfit.data[0]?.profit).toBe(14789.92);
      expect(saleItemFindMany.mock.calls[0]?.[0].where).toMatchObject({
        sale: { status: SaleStatus.COMPLETED },
      });
    });

    it('acumula las líneas repetidas de un mismo producto', async () => {
      const { service, saleItemFindMany } = createMocks();

      saleItemFindMany.mockResolvedValue([
        itemRow({ quantity: 2, lineTotal: new Prisma.Decimal(20000) }),
        itemRow({ quantity: 3, lineTotal: new Prisma.Decimal(30000) }),
      ]);

      const result = await service.topProducts({
        ...RANGE,
        limit: 10,
        sortBy: 'quantity',
      } as QueryTopProductsDto);

      expect(result.data).toEqual([
        {
          productId: PRODUCT_ID,
          name: 'Agua Cristal 600 ml',
          sku: 'BEB-001',
          quantity: 5,
          revenue: 50000,
          profit: 4000,
        },
      ]);
    });
  });

  describe('paymentMethods', () => {
    it('agrega los cobros por método y suma los totales', async () => {
      const { service, paymentFindMany } = createMocks();

      paymentFindMany.mockResolvedValue([
        { method: PaymentMethod.CASH, amount: new Prisma.Decimal(117000) },
        { method: PaymentMethod.CASH, amount: new Prisma.Decimal(10000) },
        { method: PaymentMethod.CARD, amount: new Prisma.Decimal(32000) },
      ]);

      const result = await service.paymentMethods({ ...RANGE });

      expect(result.range).toEqual({ from: RANGE.from, to: RANGE.to });
      expect(result.data).toEqual([
        { method: PaymentMethod.CASH, transactions: 2, amount: 127000 },
        { method: PaymentMethod.CARD, transactions: 1, amount: 32000 },
      ]);
      expect(result.total).toEqual({ transactions: 3, amount: 159000 });
      expect(paymentFindMany.mock.calls[0]?.[0].where).toMatchObject({
        sale: { status: SaleStatus.COMPLETED },
      });
    });

    it('incluye CASH y CARD con ceros cuando no aparecen', async () => {
      const { service, paymentFindMany } = createMocks();

      paymentFindMany.mockResolvedValue([
        { method: PaymentMethod.CASH, amount: new Prisma.Decimal(5000) },
      ]);

      const result = await service.paymentMethods({ ...RANGE });

      expect(result.data).toEqual([
        { method: PaymentMethod.CASH, transactions: 1, amount: 5000 },
        { method: PaymentMethod.CARD, transactions: 0, amount: 0 },
      ]);
      expect(result.total).toEqual({ transactions: 1, amount: 5000 });
    });
  });

  describe('lowStock', () => {
    it('calcula el déficit, ordena por stock y aplica el límite', async () => {
      const { service, productFindMany, minStockField } = createMocks();

      productFindMany.mockResolvedValue([
        {
          id: PRODUCT_ID,
          sku: 'SNK-002',
          name: 'Chocolatina Jet',
          stock: 0,
          minStock: 5,
          unit: 'unidad',
        },
        {
          id: SECOND_PRODUCT_ID,
          sku: 'SNK-001',
          name: 'Papas Margarita Pollo 105 g',
          stock: 1,
          minStock: 20,
          unit: 'paquete',
        },
      ]);

      const result = await service.lowStock({ limit: 10 });

      expect(productFindMany.mock.calls[0]?.[0]).toMatchObject({
        where: {
          active: true,
          deletedAt: null,
          stock: { lte: minStockField },
        },
        orderBy: [{ stock: 'asc' }, { name: 'asc' }],
        take: 10,
      });
      expect(result.data).toEqual([
        {
          id: PRODUCT_ID,
          sku: 'SNK-002',
          name: 'Chocolatina Jet',
          stock: 0,
          minStock: 5,
          deficit: 5,
          unit: 'unidad',
        },
        {
          id: SECOND_PRODUCT_ID,
          sku: 'SNK-001',
          name: 'Papas Margarita Pollo 105 g',
          stock: 1,
          minStock: 20,
          deficit: 19,
          unit: 'paquete',
        },
      ]);
    });

    it('devuelve una lista vacía cuando no hay productos críticos', async () => {
      const { service, productFindMany } = createMocks();

      productFindMany.mockResolvedValue([]);

      await expect(service.lowStock({ limit: 5 })).resolves.toEqual({
        data: [],
      });
    });
  });
});
