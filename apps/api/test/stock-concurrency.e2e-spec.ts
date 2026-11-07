import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PriceField,
  StockMovementType,
  type PrismaClient,
} from '../src/generated/prisma/client.js';
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

const MOVEMENTS_PATH = '/api/v1/inventory/movements';

describe('Inventory concurrency (e2e)', () => {
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

  it('deja pasar solo un ajuste concurrente y conserva el stock consistente', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
      stock: 10,
      costPrice: 1000,
      salePrice: 2000,
      minStock: 4,
    });
    const agent = await loginAs(app);

    const payload = {
      productId: product.id,
      type: 'ADJUSTMENT',
      quantity: -7,
      reason: 'Conteo físico simultáneo',
    };

    // Ambas peticiones compiten por la misma fila (`FOR UPDATE`).
    const responses = await Promise.all([
      agent.post(MOVEMENTS_PATH).send(payload),
      agent.post(MOVEMENTS_PATH).send(payload),
    ]);

    const statuses = responses
      .map((response) => response.status)
      .sort((left, right) => left - right);

    expect(statuses).toEqual([201, 409]);

    const stored = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(stored.stock).toBe(3);
    expect(stored.costPrice.toNumber()).toBe(1000);

    const movements = await client.stockMovement.findMany({
      where: { productId: product.id },
    });

    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: StockMovementType.ADJUSTMENT,
      quantity: -7,
      previousStock: 10,
      newStock: 3,
    });
    expect(movements[0]?.unitCost.toNumber()).toBe(1000);

    const rejected = responses.find((response) => response.status === 409);

    expect(rejected?.body).toMatchObject({
      message: expect.stringContaining('Stock insuficiente'),
    });

    const accepted = responses.find((response) => response.status === 201);

    expect(accepted?.body).toMatchObject({
      previousStock: 10,
      newStock: 3,
      quantity: -7,
    });
  }, 30000);

  it('serializa tres entradas concurrentes y promedia el costo ponderado', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
      stock: 10,
      costPrice: 1000,
      salePrice: 2000,
      minStock: 4,
    });
    const agent = await loginAs(app);

    const responses = await Promise.all(
      [2000, 3000, 4000].map((unitCost) =>
        agent.post(MOVEMENTS_PATH).send({
          productId: product.id,
          type: 'ENTRY',
          quantity: 10,
          unitCost,
          reason: 'Compra concurrente a proveedor',
        }),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(201);
    }

    const stored = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(stored.stock).toBe(40);
    expect(stored.costPrice.toNumber()).toBe(2500);

    const movements = await client.stockMovement.findMany({
      where: { productId: product.id },
      select: {
        type: true,
        quantity: true,
        previousStock: true,
        newStock: true,
      },
    });

    expect(movements).toHaveLength(3);
    expect(
      movements
        .map((movement) => [movement.previousStock, movement.newStock])
        .sort((left, right) => left[0] - right[0]),
    ).toEqual([
      [10, 20],
      [20, 30],
      [30, 40],
    ]);
    expect(
      movements.every(
        (movement) => movement.type === StockMovementType.ENTRY,
      ),
    ).toBe(true);

    const history = await client.priceHistory.findMany({
      where: { productId: product.id, field: PriceField.COST },
      select: { newValue: true },
    });

    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(
      history.some((entry) => entry.newValue.toNumber() === 2500),
    ).toBe(true);
  }, 30000);
});
