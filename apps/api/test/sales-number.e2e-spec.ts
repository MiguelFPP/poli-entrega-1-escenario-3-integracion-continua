import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '../src/generated/prisma/client.js';
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

type SaleDetailBody = {
  id: string;
  number: string;
  total: number;
};

type Catalog = {
  water: ProductModel;
  soda: ProductModel;
  snack: ProductModel;
};

/** Tres productos con stock suficiente para una venta unitaria. */
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
  });
  const soda = await createProduct(client, {
    categoryId: category.id,
    sku: 'BEB-002',
    name: 'Gaseosa 400 ml',
    costPrice: 11000,
    salePrice: 15700,
    stock: 10,
    minStock: 2,
  });
  const snack = await createProduct(client, {
    categoryId: category.id,
    sku: 'SNK-001',
    name: 'Papas Margarita Pollo 105 g',
    costPrice: 10000,
    salePrice: 15000,
    stock: 10,
    minStock: 2,
  });

  return { water, soda, snack };
}

describe('Sales numbering (e2e)', () => {
  let app: INestApplication;
  let client: PrismaClient;
  let rateLimit: RateLimitService;

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

    await createUser(client, {
      email: ADMIN_CREDENTIALS.email,
      password: ADMIN_CREDENTIALS.password,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (client) {
      await client.$disconnect();
    }
  });

  it('asigna consecutivos crecientes a dos ventas consecutivas', async () => {
    const catalog = await createCatalog(client);
    const agent = await loginAs(app);

    const first = await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: catalog.water.id, quantity: 1 }],
        payment: { method: 'CARD' },
      })
      .expect(201);
    const second = await agent
      .post(SALES_PATH)
      .send({
        items: [{ productId: catalog.soda.id, quantity: 1 }],
        payment: { method: 'CARD' },
      })
      .expect(201);

    const firstSale = first.body as SaleDetailBody;
    const secondSale = second.body as SaleDetailBody;

    expect(firstSale.number).toBe('V-000001');
    expect(secondSale.number).toBe('V-000002');
    expect(firstSale.id).not.toBe(secondSale.id);

    const stored = await client.sale.findMany({
      orderBy: { number: 'asc' },
      select: { number: true },
    });

    expect(stored.map((sale) => Number(sale.number))).toEqual([1, 2]);
  }, 30000);

  it('genera números únicos en ventas concurrentes sin fallar', async () => {
    const catalog = await createCatalog(client);
    const agent = await loginAs(app);

    const responses = await Promise.all([
      agent.post(SALES_PATH).send({
        items: [{ productId: catalog.water.id, quantity: 1 }],
        payment: { method: 'CARD' },
      }),
      agent.post(SALES_PATH).send({
        items: [{ productId: catalog.soda.id, quantity: 1 }],
        payment: { method: 'CASH', cashReceived: 20000 },
      }),
      agent.post(SALES_PATH).send({
        items: [{ productId: catalog.snack.id, quantity: 1 }],
        payment: { method: 'CARD' },
      }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(201);
      expect(response.status).toBeLessThan(500);
    }

    const numbers = responses.map(
      (response) => (response.body as SaleDetailBody).number,
    );

    expect(new Set(numbers).size).toBe(3);
    expect(numbers.sort((left, right) => left.localeCompare(right))).toEqual([
      'V-000001',
      'V-000002',
      'V-000003',
    ]);

    const stored = await client.sale.findMany({ select: { number: true } });

    expect(stored).toHaveLength(3);
    expect(
      new Set(stored.map((sale) => sale.number.toString())).size,
    ).toBe(3);

    const sequence = await client.$queryRaw<Array<{ last_value: bigint }>>`
      SELECT last_value FROM sale_number_seq
    `;

    expect(Number(sequence[0]?.last_value)).toBe(3);
  }, 30000);
});
