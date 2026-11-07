import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  SaleStatus,
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
  sku: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
};

type SaleDetailBody = {
  id: string;
  number: string;
  status: 'COMPLETED' | 'VOIDED';
  total: number;
  itemCount: number;
  paymentMethod: 'CASH' | 'CARD' | null;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  user: SaleUserBody;
  voidedBy: SaleUserBody | null;
  items: SaleItemBody[];
};

type SaleSummaryBody = {
  id: string;
  number: string;
  status: 'COMPLETED' | 'VOIDED';
  total: number;
  voidedAt: string | null;
};

type PaginatedSalesBody = {
  data: SaleSummaryBody[];
  meta: { total: number };
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

describe('Sales void (e2e)', () => {
  let app: INestApplication;
  let client: PrismaClient;
  let rateLimit: RateLimitService;
  let adminId: string;

  const stockOf = async (productId: string): Promise<number> => {
    const product = await client.product.findUniqueOrThrow({
      where: { id: productId },
    });

    return product.stock;
  };

  const sell = async (
    agent: ReturnType<typeof request.agent>,
    catalog: Catalog,
  ): Promise<SaleDetailBody> => {
    const response = await agent
      .post(SALES_PATH)
      .send({
        items: [
          { productId: catalog.water.id, quantity: 2 },
          { productId: catalog.soda.id, quantity: 1 },
        ],
        payment: { method: 'CARD' },
      })
      .expect(201);

    return response.body as SaleDetailBody;
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

  it('anula la venta, restaura el stock y deja la trazabilidad', async () => {
    const catalog = await createCatalog(client);
    const agent = await loginAs(app);
    const sale = await sell(agent, catalog);

    expect(await stockOf(catalog.water.id)).toBe(8);
    expect(await stockOf(catalog.soda.id)).toBe(4);

    const response = await agent
      .post(`${SALES_PATH}/${sale.id}/void`)
      .send({ reason: '  Error de digitación del cajero  ' })
      .expect(200);

    const voided = response.body as SaleDetailBody;

    expect(voided).toMatchObject({
      id: sale.id,
      number: 'V-000001',
      status: SaleStatus.VOIDED,
      voidReason: 'Error de digitación del cajero',
    });
    expect(voided.voidedBy).toEqual({
      id: adminId,
      name: expect.any(String),
      email: ADMIN_CREDENTIALS.email,
    });
    expect(Number.isNaN(Date.parse(voided.voidedAt ?? ''))).toBe(false);
    expect(voided.items).toHaveLength(2);

    expect(await stockOf(catalog.water.id)).toBe(10);
    expect(await stockOf(catalog.soda.id)).toBe(5);

    const movements = await client.stockMovement.findMany({
      where: { saleId: sale.id },
    });
    const voids = movements.filter(
      (movement) => movement.type === StockMovementType.VOID,
    );
    const sales = movements.filter(
      (movement) => movement.type === StockMovementType.SALE,
    );

    expect(sales).toHaveLength(2);
    expect(sales.every((movement) => movement.quantity < 0)).toBe(true);
    expect(voids).toHaveLength(2);
    expect(voids.every((movement) => movement.quantity > 0)).toBe(true);
    expect(
      voids.every(
        (movement) => movement.reason === 'Error de digitación del cajero',
      ),
    ).toBe(true);
    expect(voids.every((movement) => movement.userId === adminId)).toBe(true);

    const waterVoid = voids.find(
      (movement) => movement.productId === catalog.water.id,
    );
    const sodaVoid = voids.find(
      (movement) => movement.productId === catalog.soda.id,
    );

    expect(waterVoid).toMatchObject({
      quantity: 2,
      previousStock: 8,
      newStock: 10,
    });
    expect(waterVoid?.unitCost.toNumber()).toBe(6500);
    expect(sodaVoid).toMatchObject({
      quantity: 1,
      previousStock: 4,
      newStock: 5,
    });
    expect(sodaVoid?.unitCost.toNumber()).toBe(11000);
  });

  it('exige un motivo válido y distingue 404 de 409', async () => {
    const catalog = await createCatalog(client);
    const agent = await loginAs(app);
    const sale = await sell(agent, catalog);

    await agent.post(`${SALES_PATH}/${sale.id}/void`).send({}).expect(400);
    await agent
      .post(`${SALES_PATH}/${sale.id}/void`)
      .send({ reason: '  ' })
      .expect(400);
    await agent
      .post(`${SALES_PATH}/${sale.id}/void`)
      .send({ reason: 'ab' })
      .expect(400);
    await agent
      .post(`${SALES_PATH}/${sale.id}/void`)
      .send({ reason: 'x'.repeat(256) })
      .expect(400);
    await agent
      .post(`${SALES_PATH}/not-a-uuid/void`)
      .send({ reason: 'Error de digitación' })
      .expect(400);
    await agent
      .post(`${SALES_PATH}/${UNKNOWN_UUID}/void`)
      .send({ reason: 'Error de digitación' })
      .expect(404);

    const stored = await client.sale.findUniqueOrThrow({
      where: { id: sale.id },
    });

    expect(stored.status).toBe(SaleStatus.COMPLETED);
    expect(await stockOf(catalog.water.id)).toBe(8);

    await agent
      .post(`${SALES_PATH}/${sale.id}/void`)
      .send({ reason: 'Error de digitación' })
      .expect(200);
    await agent
      .post(`${SALES_PATH}/${sale.id}/void`)
      .send({ reason: 'Cliente desistió de la compra' })
      .expect(409);

    expect(await client.sale.count()).toBe(1);
    expect(await stockOf(catalog.water.id)).toBe(10);
    expect(await stockOf(catalog.soda.id)).toBe(5);
    expect(
      await client.stockMovement.count({ where: { saleId: sale.id } }),
    ).toBe(4);
  });

  it('deja la venta anulada fuera de los KPIs al filtrar por estado', async () => {
    const catalog = await createCatalog(client);
    const agent = await loginAs(app);
    const voidedSale = await sell(agent, catalog);
    const completedSale = await sell(agent, catalog);

    await agent
      .post(`${SALES_PATH}/${voidedSale.id}/void`)
      .send({ reason: 'Pago no aprobado' })
      .expect(200);

    const voided = await agent
      .get(SALES_PATH)
      .query({ status: 'VOIDED' })
      .expect(200);
    const voidedBody = voided.body as PaginatedSalesBody;

    expect(voidedBody.meta.total).toBe(1);
    expect(voidedBody.data[0]).toMatchObject({
      id: voidedSale.id,
      number: 'V-000001',
      status: SaleStatus.VOIDED,
    });
    expect(typeof voidedBody.data[0]?.voidedAt).toBe('string');

    const completed = await agent
      .get(SALES_PATH)
      .query({ status: 'COMPLETED' })
      .expect(200);
    const completedBody = completed.body as PaginatedSalesBody;

    expect(completedBody.meta.total).toBe(1);
    expect(completedBody.data.map((sale) => sale.id)).toEqual([
      completedSale.id,
    ]);
    expect(
      completedBody.data.reduce((acc, item) => acc + item.total, 0),
    ).toBe(completedSale.total);

    const all = await agent.get(SALES_PATH).expect(200);

    expect((all.body as PaginatedSalesBody).meta.total).toBe(2);
  });
});
