import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import { createCategory, createUser } from '../prisma/factories/index.js';
import { ADMIN_CREDENTIALS, loginAs } from './auth-client.js';
import { resetDatabase, setupTestDatabase } from './db.js';

type ProductBody = {
  id: string;
};

type HistoryEntry = {
  id: string;
  productId: string;
  field: 'COST' | 'SALE';
  oldValue: number;
  newValue: number;
  changedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
};

type PaginatedHistory = {
  data: HistoryEntry[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

describe('PriceHistory (e2e)', () => {
  let app: INestApplication;
  let client: PrismaClient;
  let rateLimit: RateLimitService;
  let adminId: string;

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

  async function createProductViaApi(
    agent: Awaited<ReturnType<typeof loginAs>>,
    categoryId: string,
  ): Promise<string> {
    const response = await agent
      .post('/api/v1/products')
      .send({
        sku: 'BEB-001',
        barcode: '7701000000011',
        name: 'Agua Cristal 600 ml',
        categoryId,
        costPrice: 1200,
        salePrice: 2000,
        minStock: 24,
        unit: 'botella',
      })
      .expect(201);

    return (response.body as ProductBody).id;
  }

  it('registra los precios iniciales COST y SALE al crear el producto', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);
    const productId = await createProductViaApi(agent, category.id);

    const response = await agent
      .get(`/api/v1/products/${productId}/price-history`)
      .expect(200);

    const body = response.body as PaginatedHistory;

    expect(body.meta).toMatchObject({ total: 2, totalPages: 1 });
    expect(body.data).toHaveLength(2);

    const cost = body.data.find((entry) => entry.field === 'COST');
    const sale = body.data.find((entry) => entry.field === 'SALE');

    expect(cost).toMatchObject({ oldValue: 0, newValue: 1200 });
    expect(sale).toMatchObject({ oldValue: 0, newValue: 2000 });

    for (const entry of body.data) {
      expect(entry.productId).toBe(productId);
      expect(entry.changedBy).toEqual({
        id: adminId,
        name: expect.any(String),
        email: ADMIN_CREDENTIALS.email,
      });
    }
  });

  it('cada cambio de precio crea un registro con el usuario que lo hizo', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);
    const productId = await createProductViaApi(agent, category.id);

    await agent
      .patch(`/api/v1/products/${productId}`)
      .send({ salePrice: 2500 })
      .expect(200);

    await agent
      .patch(`/api/v1/products/${productId}`)
      .send({ costPrice: 1300, salePrice: 2700 })
      .expect(200);

    const response = await agent
      .get(`/api/v1/products/${productId}/price-history`)
      .expect(200);

    const body = response.body as PaginatedHistory;

    expect(body.meta.total).toBe(5);

    const sales = body.data.filter((entry) => entry.field === 'SALE');
    const costs = body.data.filter((entry) => entry.field === 'COST');

    expect(sales).toHaveLength(3);
    expect(costs).toHaveLength(2);

    expect(sales).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ oldValue: 2000, newValue: 2500 }),
        expect.objectContaining({ oldValue: 2500, newValue: 2700 }),
      ]),
    );
    expect(costs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ oldValue: 1200, newValue: 1300 }),
      ]),
    );

    for (const entry of body.data) {
      expect(entry.changedBy?.id).toBe(adminId);
    }
  });

  it('pagina el historial con los más recientes primero', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);
    const productId = await createProductViaApi(agent, category.id);

    await agent
      .patch(`/api/v1/products/${productId}`)
      .send({ salePrice: 2600 })
      .expect(200);

    const first = await agent
      .get(`/api/v1/products/${productId}/price-history`)
      .query({ page: 1, pageSize: 2 })
      .expect(200);

    const firstBody = first.body as PaginatedHistory;

    expect(firstBody.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(firstBody.data).toHaveLength(2);

    const second = await agent
      .get(`/api/v1/products/${productId}/price-history`)
      .query({ page: 2, pageSize: 2 })
      .expect(200);

    const secondBody = second.body as PaginatedHistory;

    expect(secondBody.meta).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(secondBody.data).toHaveLength(1);

    const ids = [...firstBody.data, ...secondBody.data].map(
      (entry) => entry.id,
    );

    expect(new Set(ids).size).toBe(3);
  });

  it('responde 404 si el producto no existe', async () => {
    const agent = await loginAs(app);

    await agent
      .get(
        '/api/v1/products/00000000-0000-4000-8000-000000000000/price-history',
      )
      .expect(404);
  });
});
