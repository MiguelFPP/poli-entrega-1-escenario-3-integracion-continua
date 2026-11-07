import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  PaymentMethod,
  StockMovementType,
  type PrismaClient,
} from '../src/generated/prisma/client.js';
import type { ProductModel } from '../src/generated/prisma/models.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import {
  createCategory,
  createProduct,
  createSale,
  createStockMovement,
  createUser,
} from '../prisma/factories/index.js';
import { ADMIN_CREDENTIALS, loginAs } from './auth-client.js';
import { resetDatabase, setupTestDatabase } from './db.js';

const DASHBOARD_PATH = '/api/v1/dashboard';

const FEBRUARY_RANGE = {
  from: '2026-02-01T00:00:00.000Z',
  to: '2026-02-28T23:59:59.999Z',
} as const;

type RangeBody = { from: string; to: string };

type SummaryBody = {
  range: RangeBody;
  totalSales: number;
  grossSales: number;
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  margin: number;
  averageTicket: number;
  transactionCount: number;
  discounts: number;
  shrinkage: number;
  losses: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
};

type TrendPointBody = {
  period: string;
  totalSales: number;
  netSales: number;
  grossProfit: number;
  transactions: number;
};

type TrendBody = {
  range: RangeBody;
  granularity: 'day' | 'week' | 'month';
  data: TrendPointBody[];
};

type TopProductBody = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
  profit: number;
};

type TopProductsBody = {
  range: RangeBody;
  sortBy: 'quantity' | 'revenue' | 'profit';
  data: TopProductBody[];
};

type PaymentMethodBreakdownBody = {
  method: 'CASH' | 'CARD';
  transactions: number;
  amount: number;
};

type PaymentMethodsBody = {
  range: RangeBody;
  data: PaymentMethodBreakdownBody[];
  total: { transactions: number; amount: number };
};

type LowStockBody = {
  data: Array<{
    id: string;
    sku: string;
    name: string;
    stock: number;
    minStock: number;
    deficit: number;
    unit: string;
  }>;
};

type DashboardDataset = {
  water: ProductModel;
  soda: ProductModel;
  snack: ProductModel;
  out: ProductModel;
};

/** Datos de la fase: ventas dentro y fuera del rango, una anulada y una merma. */
async function seedDashboard(
  client: PrismaClient,
  adminId: string,
): Promise<DashboardDataset> {
  const category = await createCategory(client, { name: 'Abarrotes' });

  const water = await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-001',
    name: 'Agua Cristal 600 ml',
    costPrice: 6500,
    salePrice: 10000,
    stock: 20,
    minStock: 2,
    unit: 'botella',
  });
  const soda = await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-002',
    name: 'Gaseosa 400 ml',
    costPrice: 30000,
    salePrice: 45000,
    stock: 10,
    minStock: 2,
    unit: 'botella',
  });
  const snack = await createProduct(client, {
    categoryId: category.id,
    sku: 'SNK-001',
    name: 'Papas Margarita Pollo 105 g',
    costPrice: 1800,
    salePrice: 4000,
    stock: 12,
    minStock: 20,
    unit: 'paquete',
  });
  const out = await createProduct(client, {
    categoryId: category.id,
    sku: 'SNK-002',
    name: 'Chocolatina Jet',
    costPrice: 1200,
    salePrice: 2500,
    stock: 0,
    minStock: 5,
    unit: 'unidad',
  });

  // Inactivo y eliminado: nunca entran en los KPIs ni en las alertas.
  await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-999',
    name: 'Inactivo crítico',
    costPrice: 1000,
    salePrice: 2000,
    stock: 0,
    minStock: 9,
    active: false,
  });
  await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-998',
    name: 'Eliminado crítico',
    costPrice: 1000,
    salePrice: 2000,
    stock: 0,
    minStock: 9,
    deletedAt: new Date(),
  });

  // 2026-02-01 10:00 en Bogota: CASH, 117.000 COP con 3.000 de descuento.
  await createSale(client, {
    userId: adminId,
    createdAt: new Date('2026-02-01T15:00:00.000Z'),
    paymentMethod: PaymentMethod.CASH,
    cashReceived: 120000,
    withStockMovements: true,
    items: [
      {
        productId: water.id,
        productName: water.name,
        sku: water.sku,
        quantity: 3,
        unitPrice: 10000,
        unitCost: 6500,
        discount: 2000,
      },
      {
        productId: soda.id,
        productName: soda.name,
        sku: soda.sku,
        quantity: 2,
        unitPrice: 45000,
        unitCost: 30000,
        discount: 1000,
      },
    ],
  });

  // 2026-02-02 03:30Z es 2026-02-01 22:30 en Bogota: cae en el día anterior.
  await createSale(client, {
    userId: adminId,
    createdAt: new Date('2026-02-02T03:30:00.000Z'),
    paymentMethod: PaymentMethod.CARD,
    withStockMovements: true,
    items: [
      {
        productId: water.id,
        productName: water.name,
        sku: water.sku,
        quantity: 1,
        unitPrice: 10000,
        unitCost: 6500,
      },
    ],
  });

  await createSale(client, {
    userId: adminId,
    createdAt: new Date('2026-02-03T14:00:00.000Z'),
    paymentMethod: PaymentMethod.CASH,
    cashReceived: 10000,
    withStockMovements: true,
    items: [
      {
        productId: water.id,
        productName: water.name,
        sku: water.sku,
        quantity: 1,
        unitPrice: 10000,
        unitCost: 6500,
      },
    ],
  });

  await createSale(client, {
    userId: adminId,
    createdAt: new Date('2026-02-02T15:00:00.000Z'),
    paymentMethod: PaymentMethod.CARD,
    withStockMovements: true,
    items: [
      {
        productId: snack.id,
        productName: snack.name,
        sku: snack.sku,
        quantity: 8,
        unitPrice: 4000,
        unitCost: 1800,
      },
    ],
  });

  // Fuera del rango: no entra en los KPIs aunque sí en el inventario.
  await createSale(client, {
    userId: adminId,
    createdAt: new Date('2026-01-20T12:00:00.000Z'),
    paymentMethod: PaymentMethod.CARD,
    withStockMovements: true,
    items: [
      {
        productId: snack.id,
        productName: snack.name,
        sku: snack.sku,
        quantity: 1,
        unitPrice: 4000,
        unitCost: 1800,
      },
    ],
  });

  // Anulada: revierte el stock y queda excluida de los KPIs.
  await createSale(client, {
    userId: adminId,
    createdAt: new Date('2026-02-05T16:00:00.000Z'),
    paymentMethod: PaymentMethod.CASH,
    cashReceived: 20000,
    voided: true,
    items: [
      {
        productId: water.id,
        productName: water.name,
        sku: water.sku,
        quantity: 2,
        unitPrice: 10000,
        unitCost: 6500,
      },
    ],
  });

  // Merma del rango: 2 unidades del snack a su costo vigente (3.600 COP).
  await createStockMovement(client, {
    productId: snack.id,
    quantity: -2,
    type: StockMovementType.ADJUSTMENT,
    unitCost: 1800,
    reason: 'Empaques rotos en bodega',
    createdAt: new Date('2026-02-04T18:00:00.000Z'),
  });

  // Ajuste anterior al rango: no cuenta como merma.
  await createStockMovement(client, {
    productId: water.id,
    quantity: -1,
    type: StockMovementType.ADJUSTMENT,
    unitCost: 6500,
    reason: 'Conteo físico de enero',
    createdAt: new Date('2026-01-10T18:00:00.000Z'),
  });

  return { water, soda, snack, out };
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let client: PrismaClient;
  let rateLimit: RateLimitService;
  let adminId: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    client = await setupTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rateLimit = app.get(RateLimitService);
  }, 30000);

  beforeEach(async () => {
    await resetDatabase(client);
    rateLimit.reset();

    const admin = await createUser(client, {
      email: ADMIN_CREDENTIALS.email,
      password: ADMIN_CREDENTIALS.password,
    });

    adminId = admin.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (client) {
      await client.$disconnect();
    }
  });

  it('responde 401 sin sesión en todos los endpoints del dashboard', async () => {
    await request(server()).get(`${DASHBOARD_PATH}/summary`).expect(401);
    await request(server()).get(`${DASHBOARD_PATH}/sales-trend`).expect(401);
    await request(server()).get(`${DASHBOARD_PATH}/top-products`).expect(401);
    await request(server())
      .get(`${DASHBOARD_PATH}/payment-methods`)
      .expect(401);
    await request(server()).get(`${DASHBOARD_PATH}/low-stock`).expect(401);
  });

  it('rechaza rangos inválidos, filtros fuera de rango y parámetros desconocidos', async () => {
    const agent = await loginAs(app);

    await agent
      .get(`${DASHBOARD_PATH}/summary`)
      .query({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
      })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/summary`)
      .query({ from: 'ayer' })
      .expect(400);
    await agent.get(`${DASHBOARD_PATH}/summary`).query({ foo: '1' }).expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/sales-trend`)
      .query({ granularity: 'hour' })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/sales-trend`)
      .query({ ...FEBRUARY_RANGE, to: '2026-01-01T00:00:00.000Z' })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/top-products`)
      .query({ limit: 51 })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/top-products`)
      .query({ sortBy: 'name' })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/payment-methods`)
      .query({ foo: '1' })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/low-stock`)
      .query({ limit: 0 })
      .expect(400);
    await agent
      .get(`${DASHBOARD_PATH}/low-stock`)
      .query({ foo: '1' })
      .expect(400);
  });

  it('resume los KPIs del rango excluyendo la venta anulada y la fuera del rango', async () => {
    await seedDashboard(client, adminId);
    const agent = await loginAs(app);

    const response = await agent
      .get(`${DASHBOARD_PATH}/summary`)
      .query(FEBRUARY_RANGE)
      .expect(200);

    expect(response.body as SummaryBody).toEqual({
      range: { from: FEBRUARY_RANGE.from, to: FEBRUARY_RANGE.to },
      totalSales: 169000,
      grossSales: 172000,
      netSales: 142016.81,
      costOfSales: 106900,
      grossProfit: 35116.81,
      margin: 24.73,
      averageTicket: 42250,
      transactionCount: 4,
      discounts: 3000,
      shrinkage: 3600,
      losses: 6600,
      inventoryValue: 332800,
      lowStockCount: 2,
      outOfStockCount: 1,
    });

    const noSales = await agent
      .get(`${DASHBOARD_PATH}/summary`)
      .query({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
      })
      .expect(200);
    const empty = noSales.body as SummaryBody;

    expect(empty).toMatchObject({
      totalSales: 0,
      netSales: 0,
      grossProfit: 0,
      margin: 0,
      averageTicket: 0,
      transactionCount: 0,
      discounts: 0,
      shrinkage: 0,
      losses: 0,
      inventoryValue: 332800,
      lowStockCount: 2,
      outOfStockCount: 1,
    });
  });

  it('agrupa la tendencia por día, semana y mes en la zona Bogota', async () => {
    await seedDashboard(client, adminId);
    const agent = await loginAs(app);

    const daily = await agent
      .get(`${DASHBOARD_PATH}/sales-trend`)
      .query(FEBRUARY_RANGE)
      .expect(200);
    const dailyBody = daily.body as TrendBody;

    expect(dailyBody.granularity).toBe('day');
    expect(dailyBody.range).toEqual({
      from: FEBRUARY_RANGE.from,
      to: FEBRUARY_RANGE.to,
    });
    expect(dailyBody.data).toEqual([
      {
        period: '2026-02-01',
        totalSales: 127000,
        netSales: 106722.69,
        grossProfit: 20722.69,
        transactions: 2,
      },
      {
        period: '2026-02-02',
        totalSales: 32000,
        netSales: 26890.76,
        grossProfit: 12490.76,
        transactions: 1,
      },
      {
        period: '2026-02-03',
        totalSales: 10000,
        netSales: 8403.36,
        grossProfit: 1903.36,
        transactions: 1,
      },
    ]);

    const monthly = await agent
      .get(`${DASHBOARD_PATH}/sales-trend`)
      .query({ ...FEBRUARY_RANGE, granularity: 'month' })
      .expect(200);

    expect((monthly.body as TrendBody).data).toEqual([
      {
        period: '2026-02',
        totalSales: 169000,
        netSales: 142016.81,
        grossProfit: 35116.81,
        transactions: 4,
      },
    ]);

    const weekly = await agent
      .get(`${DASHBOARD_PATH}/sales-trend`)
      .query({ ...FEBRUARY_RANGE, granularity: 'week' })
      .expect(200);

    // 2026-02-01 es domingo (lunes 26-01) y el 02 y 03 son lunes y martes.
    expect((weekly.body as TrendBody).data).toEqual([
      {
        period: '2026-01-26',
        totalSales: 127000,
        netSales: 106722.69,
        grossProfit: 20722.69,
        transactions: 2,
      },
      {
        period: '2026-02-02',
        totalSales: 42000,
        netSales: 35294.12,
        grossProfit: 14394.12,
        transactions: 2,
      },
    ]);
  });

  it('ordena el top de productos por cantidad, ingresos y ganancia', async () => {
    const { snack, out } = await seedDashboard(client, adminId);
    const agent = await loginAs(app);
    const storedSnack = await client.product.findUniqueOrThrow({
      where: { id: snack.id },
    });

    expect(storedSnack.stock).toBe(1);
    expect(out.stock).toBe(0);

    const byQuantity = await agent
      .get(`${DASHBOARD_PATH}/top-products`)
      .query({ ...FEBRUARY_RANGE, sortBy: 'quantity' })
      .expect(200);
    const quantityBody = byQuantity.body as TopProductsBody;

    expect(quantityBody.sortBy).toBe('quantity');
    expect(quantityBody.data.map((item) => item.sku)).toEqual([
      'SNK-001',
      'BEB-001',
      'BEB-002',
    ]);
    expect(quantityBody.data[0]).toEqual({
      productId: snack.id,
      name: 'Papas Margarita Pollo 105 g',
      sku: 'SNK-001',
      quantity: 8,
      revenue: 32000,
      profit: 12490.76,
    });

    const byRevenue = await agent
      .get(`${DASHBOARD_PATH}/top-products`)
      .query({ ...FEBRUARY_RANGE, sortBy: 'revenue', limit: 2 })
      .expect(200);

    const byRevenueBody = byRevenue.body as TopProductsBody;

    expect(byRevenueBody.data.map((item) => item.sku)).toEqual([
      'BEB-002',
      'BEB-001',
    ]);

    const byProfit = await agent
      .get(`${DASHBOARD_PATH}/top-products`)
      .query({ ...FEBRUARY_RANGE, sortBy: 'profit', limit: 1 })
      .expect(200);
    const profitBody = byProfit.body as TopProductsBody;

    expect(profitBody.data).toHaveLength(1);
    expect(profitBody.data[0]).toMatchObject({
      sku: 'BEB-002',
      quantity: 2,
      revenue: 89000,
      profit: 14789.92,
    });
  });

  it('distribuye los cobros por método de pago e incluye los que faltan', async () => {
    await seedDashboard(client, adminId);
    const agent = await loginAs(app);

    const response = await agent
      .get(`${DASHBOARD_PATH}/payment-methods`)
      .query(FEBRUARY_RANGE)
      .expect(200);
    const body = response.body as PaymentMethodsBody;

    expect(body.data).toEqual([
      { method: 'CASH', transactions: 2, amount: 127000 },
      { method: 'CARD', transactions: 2, amount: 42000 },
    ]);
    expect(body.total).toEqual({ transactions: 4, amount: 169000 });

    const cashOnly = await agent
      .get(`${DASHBOARD_PATH}/payment-methods`)
      .query({
        from: '2026-02-03T00:00:00.000Z',
        to: '2026-02-03T23:59:59.999Z',
      })
      .expect(200);
    const cashOnlyBody = cashOnly.body as PaymentMethodsBody;

    expect(cashOnlyBody.data).toEqual([
      { method: 'CASH', transactions: 1, amount: 10000 },
      { method: 'CARD', transactions: 0, amount: 0 },
    ]);
    expect(cashOnlyBody.total).toEqual({ transactions: 1, amount: 10000 });
  });

  it('lista el stock bajo y agotado con su déficit y respeta el límite', async () => {
    const { out, snack } = await seedDashboard(client, adminId);
    const agent = await loginAs(app);

    const response = await agent
      .get(`${DASHBOARD_PATH}/low-stock`)
      .expect(200);
    const body = response.body as LowStockBody;

    expect(body.data).toEqual([
      {
        id: out.id,
        sku: 'SNK-002',
        name: 'Chocolatina Jet',
        stock: 0,
        minStock: 5,
        deficit: 5,
        unit: 'unidad',
      },
      {
        id: snack.id,
        sku: 'SNK-001',
        name: 'Papas Margarita Pollo 105 g',
        stock: 1,
        minStock: 20,
        deficit: 19,
        unit: 'paquete',
      },
    ]);

    const limited = await agent
      .get(`${DASHBOARD_PATH}/low-stock`)
      .query({ limit: 1 })
      .expect(200);

    expect((limited.body as LowStockBody).data).toHaveLength(1);
    expect((limited.body as LowStockBody).data[0]?.sku).toBe('SNK-002');
  });
});
