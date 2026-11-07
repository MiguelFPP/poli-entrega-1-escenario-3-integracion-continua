import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  Role,
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
  createUser,
} from '../prisma/factories/index.js';
import { ADMIN_CREDENTIALS, loginAs } from './auth-client.js';
import { resetDatabase, setupTestDatabase } from './db.js';

const SALES_PATH = '/api/v1/sales';
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

type SaleUserBody = { id: string; name: string; email: string };

type SaleItemBody = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
  lineProfit: number;
};

type SalePaymentBody = {
  id: string;
  method: 'CASH' | 'CARD';
  amount: number;
  cashReceived: number | null;
  changeGiven: number | null;
  createdAt: string;
};

type SaleSummaryBody = {
  id: string;
  number: string;
  status: 'COMPLETED' | 'VOIDED';
  total: number;
  itemCount: number;
  paymentMethod: 'CASH' | 'CARD' | null;
  createdAt: string;
  voidedAt: string | null;
  user: SaleUserBody;
};

type SaleDetailBody = SaleSummaryBody & {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  costTotal: number;
  profit: number;
  voidReason: string | null;
  voidedBy: SaleUserBody | null;
  items: SaleItemBody[];
  payment: SalePaymentBody | null;
};

type PaginatedSalesBody = {
  data: SaleSummaryBody[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type Catalog = {
  water: ProductModel;
  soda: ProductModel;
};

/** Base: A = 10.000 COP (costo 6.500) y B = 15.700 COP (costo 11.000). */
async function createCatalog(client: PrismaClient): Promise<Catalog> {
  const category = await createCategory(client, { name: 'Bebidas' });

  const water = await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-001',
    name: 'Agua Cristal 600 ml',
    costPrice: 6500,
    salePrice: 10000,
    stock: 10,
    minStock: 2,
    unit: 'botella',
  });
  const soda = await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-002',
    name: 'Gaseosa 400 ml',
    costPrice: 11000,
    salePrice: 15700,
    stock: 5,
    minStock: 2,
    unit: 'botella',
  });

  return { water, soda };
}

describe('Sales (e2e)', () => {
  let app: INestApplication;
  let client: PrismaClient;
  let rateLimit: RateLimitService;
  let adminId: string;

  const server = () => app.getHttpServer();

  const stockOf = async (productId: string): Promise<number> => {
    const product = await client.product.findUniqueOrThrow({
      where: { id: productId },
    });

    return product.stock;
  };

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

  it('responde 401 sin sesión en todos los endpoints de ventas', async () => {
    await request(server())
      .post(SALES_PATH)
      .send({
        items: [{ productId: UNKNOWN_UUID, quantity: 1 }],
        payment: { method: 'CASH', cashReceived: 1000 },
      })
      .expect(401);
    await request(server()).get(SALES_PATH).expect(401);
    await request(server()).get(`${SALES_PATH}/${UNKNOWN_UUID}`).expect(401);
    await request(server())
      .get(`${SALES_PATH}/${UNKNOWN_UUID}/receipt`)
      .expect(401);
    await request(server())
      .post(`${SALES_PATH}/${UNKNOWN_UUID}/void`)
      .send({ reason: 'Error de digitación' })
      .expect(401);

    await createUser(client, {
      email: 'cajero@pos.local',
      password: 'Cajero123!',
      role: Role.CASHIER,
    });
    const cashier = await loginAs(app, {
      email: 'cajero@pos.local',
      password: 'Cajero123!',
    });

    await cashier.get(SALES_PATH).expect(403);
  });

  it('registra una venta en efectivo con descuento prorrateado, stock y movimientos', async () => {
    const { water, soda } = await createCatalog(client);
    const agent = await loginAs(app);

    const response = await agent
      .post(SALES_PATH)
      .send({
        items: [
          { productId: water.id, quantity: 2 },
          { productId: soda.id, quantity: 1 },
        ],
        discountAmount: 3570,
        payment: { method: 'CASH', cashReceived: 40230 },
      })
      .expect(201);

    const sale = response.body as SaleDetailBody;

    // Subtotal 35700, descuento 3570 (prorrateado), IVA 5130 y total 32130.
    expect(sale).toMatchObject({
      number: 'V-000001',
      status: 'COMPLETED',
      subtotal: 35700,
      discountAmount: 3570,
      taxAmount: 5130,
      total: 32130,
      costTotal: 24000,
      profit: 3000,
      itemCount: 2,
      paymentMethod: 'CASH',
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
    });
    expect(sale.user).toEqual({
      id: adminId,
      name: expect.any(String),
      email: ADMIN_CREDENTIALS.email,
    });
    expect(sale.payment).toMatchObject({
      method: 'CASH',
      amount: 32130,
      cashReceived: 40230,
      changeGiven: 8100,
    });
    expect(sale.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: water.id,
          productName: 'Agua Cristal 600 ml',
          sku: 'BEB-001',
          quantity: 2,
          unitPrice: 10000,
          unitCost: 6500,
          lineSubtotal: 20000,
          lineDiscount: 2000,
          lineTax: 2873.95,
          lineTotal: 18000,
          lineProfit: 2126.05,
        }),
        expect.objectContaining({
          productId: soda.id,
          productName: 'Gaseosa 400 ml',
          sku: 'BEB-002',
          quantity: 1,
          unitPrice: 15700,
          unitCost: 11000,
          lineSubtotal: 15700,
          lineDiscount: 1570,
          lineTax: 2256.05,
          lineTotal: 14130,
          lineProfit: 873.95,
        }),
      ]),
    );

    expect(await stockOf(water.id)).toBe(8);
    expect(await stockOf(soda.id)).toBe(4);

    const movements = await client.stockMovement.findMany({
      where: { saleId: sale.id },
    });

    expect(movements).toHaveLength(2);
    expect(
      movements.every((movement) => movement.type === StockMovementType.SALE),
    ).toBe(true);
    expect(movements.every((movement) => movement.quantity < 0)).toBe(true);
    expect(
      movements
        .map((movement) => movement.quantity)
        .sort((left, right) => left - right),
    ).toEqual([-2, -1]);
    expect(
      movements
        .map((movement) => [movement.previousStock, movement.newStock])
        .sort((left, right) => left[0] - right[0]),
    ).toEqual([
      [5, 4],
      [10, 8],
    ]);
    expect(
      movements
        .map((movement) => movement.unitCost.toNumber())
        .sort((left, right) => left - right),
    ).toEqual([6500, 11000]);
    expect(movements.every((movement) => movement.userId === adminId)).toBe(
      true,
    );

    const payment = await client.payment.findUniqueOrThrow({
      where: { saleId: sale.id },
    });

    expect(payment.method).toBe('CASH');
    expect(payment.changeGiven?.toNumber()).toBe(8100);
  });

  it('registra una venta con tarjeta sin efectivo recibido', async () => {
    const { water } = await createCatalog(client);
    const agent = await loginAs(app);

    const response = await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 3 }],
        payment: { method: 'CARD' },
      })
      .expect(201);

    const sale = response.body as SaleDetailBody;

    expect(sale).toMatchObject({
      number: 'V-000001',
      discountAmount: 0,
      subtotal: 30000,
      taxAmount: 4789.92,
      total: 30000,
      itemCount: 1,
      paymentMethod: 'CARD',
    });
    expect(sale.payment).toMatchObject({
      method: 'CARD',
      amount: 30000,
      cashReceived: null,
      changeGiven: null,
    });
    expect(await stockOf(water.id)).toBe(7);
    expect(await client.stockMovement.count()).toBe(1);
  });

  it('rechaza payloads inválidos sin registrar la venta', async () => {
    const { water } = await createCatalog(client);
    const agent = await loginAs(app);

    const cash = { method: 'CASH', cashReceived: 40000 };

    await agent
      .post(SALES_PATH)
      .send({ items: [], payment: cash })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({ items: [{ productId: water.id, quantity: 0 }], payment: cash })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1.5 }],
        payment: cash,
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [
          { productId: water.id, quantity: 1 },
          { productId: water.id, quantity: 2 },
        ],
        payment: cash,
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: Array.from({ length: 101 }, () => ({
          productId: water.id,
          quantity: 1,
        })),
        payment: cash,
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        discountAmount: 10000.01,
        payment: cash,
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        discountAmount: 0.001,
        payment: cash,
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: { method: 'CASH', cashReceived: 99 },
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: { method: 'CASH' },
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: { method: 'CARD', cashReceived: 500 },
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: { method: 'TRANSFER' },
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: cash,
        foo: 1,
      })
      .expect(400);

    expect(await client.sale.count()).toBe(0);
    expect(await client.stockMovement.count()).toBe(0);
    expect(await stockOf(water.id)).toBe(10);
  });

  it('responde 409 por stock insuficiente sin tocar el inventario', async () => {
    const { water, soda } = await createCatalog(client);
    const agent = await loginAs(app);

    const response = await agent
      .post(SALES_PATH)
      .send({
        items: [
          { productId: water.id, quantity: 1 },
          { productId: soda.id, quantity: 6 },
        ],
        payment: { method: 'CARD' },
      })
      .expect(409);

    expect(response.body).toMatchObject({
      message: expect.stringContaining('Stock insuficiente'),
    });
    expect(await client.sale.count()).toBe(0);
    expect(await client.payment.count()).toBe(0);
    expect(await client.stockMovement.count()).toBe(0);
    expect(await stockOf(water.id)).toBe(10);
    expect(await stockOf(soda.id)).toBe(5);
  });

  it('rechaza productos inactivos o eliminados y responde 404 si no existe', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const inactive = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-003',
      name: 'Inactivo',
      costPrice: 6500,
      salePrice: 10000,
      stock: 10,
      active: false,
    });
    const removed = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-004',
      name: 'Eliminado',
      costPrice: 6500,
      salePrice: 10000,
      stock: 10,
      active: false,
      deletedAt: new Date(),
    });
    const agent = await loginAs(app);

    const unavailable = await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: inactive.id, quantity: 1 }],
        payment: { method: 'CARD' },
      })
      .expect(400);

    expect(unavailable.body).toMatchObject({
      message: expect.stringContaining('no está disponible para la venta'),
    });

    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: removed.id, quantity: 1 }],
        payment: { method: 'CARD' },
      })
      .expect(400);
    await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: UNKNOWN_UUID, quantity: 1 }],
        payment: { method: 'CARD' },
      })
      .expect(404);

    expect(await client.sale.count()).toBe(0);
  });

  it('lista las ventas con filtros y expone el detalle y el comprobante', async () => {
    const { water } = await createCatalog(client);
    const agent = await loginAs(app);

    const first = await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: { method: 'CASH', cashReceived: 40000 },
      })
      .expect(201);
    const second = await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: water.id, quantity: 1 }],
        payment: { method: 'CARD' },
      })
      .expect(201);

    const firstSale = first.body as SaleDetailBody;
    const secondSale = second.body as SaleDetailBody;

    expect(firstSale.number).toBe('V-000001');
    expect(secondSale.number).toBe('V-000002');

    const all = await agent.get(SALES_PATH).expect(200);
    const allBody = all.body as PaginatedSalesBody;

    expect(allBody.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(
      allBody.data.map((sale) => sale.number).sort((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(['V-000001', 'V-000002']);
    expect(allBody.data[0]).toMatchObject({
      itemCount: 1,
      user: { id: adminId, email: ADMIN_CREDENTIALS.email },
    });

    const completed = await agent
      .get(SALES_PATH)
      .query({ status: 'COMPLETED' })
      .expect(200);

    expect((completed.body as PaginatedSalesBody).meta.total).toBe(2);

    const voided = await agent
      .get(SALES_PATH)
      .query({ status: 'VOIDED' })
      .expect(200);

    expect((voided.body as PaginatedSalesBody).meta.total).toBe(0);

    const inRange = await agent
      .get(SALES_PATH)
      .query({
        from: '2000-01-01T00:00:00.000Z',
        to: '2100-01-01T00:00:00.000Z',
      })
      .expect(200);

    expect((inRange.body as PaginatedSalesBody).meta.total).toBe(2);

    const outOfRange = await agent
      .get(SALES_PATH)
      .query({
        from: '2000-01-01T00:00:00.000Z',
        to: '2000-01-02T00:00:00.000Z',
      })
      .expect(200);

    expect((outOfRange.body as PaginatedSalesBody).meta.total).toBe(0);

    const paged = await agent
      .get(SALES_PATH)
      .query({ page: 2, pageSize: 1 })
      .expect(200);

    expect((paged.body as PaginatedSalesBody).meta).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    await agent.get(SALES_PATH).query({ from: 'ayer' }).expect(400);
    await agent.get(SALES_PATH).query({ status: 'CANCELLED' }).expect(400);
    await agent.get(SALES_PATH).query({ pageSize: 101 }).expect(400);
    await agent.get(SALES_PATH).query({ foo: '1' }).expect(400);

    const detail = await agent
      .get(`${SALES_PATH}/${firstSale.id}`)
      .expect(200);
    const detailBody = detail.body as SaleDetailBody;

    expect(detailBody).toMatchObject({
      id: firstSale.id,
      number: 'V-000001',
      status: 'COMPLETED',
      itemCount: 1,
      total: 10000,
    });
    expect(detailBody.items).toHaveLength(1);

    const receipt = await agent
      .get(`${SALES_PATH}/${firstSale.id}/receipt`)
      .expect(200);

    expect(receipt.body).toEqual(detail.body);

    await agent.get(`${SALES_PATH}/${UNKNOWN_UUID}`).expect(404);
    await agent.get(`${SALES_PATH}/${UNKNOWN_UUID}/receipt`).expect(404);
    await agent.get(`${SALES_PATH}/not-a-uuid`).expect(400);
  });
});
