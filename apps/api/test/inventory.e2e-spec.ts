import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
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

type MovementBody = {
  id: string;
  productId: string;
  product: { id: string; sku: string; name: string };
  type: 'ENTRY' | 'SALE' | 'ADJUSTMENT' | 'VOID';
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  reason: string | null;
  saleId: string | null;
  user: { id: string; name: string; email: string } | null;
  createdAt: string;
};

type PaginatedMovements = {
  data: MovementBody[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  category: { id: string; name: string };
  stock: number;
  minStock: number;
  unit: string;
  deficit: number;
  costPrice: number;
  inventoryValue: number;
  lowStock: boolean;
};

type PaginatedLowStock = {
  data: LowStockItem[];
  meta: PaginatedMovements['meta'];
};

type SummaryBody = {
  totalProducts: number;
  totalUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  generatedAt: string;
};

type HistoryBody = {
  data: Array<{
    field: 'COST' | 'SALE';
    oldValue: number;
    newValue: number;
  }>;
  meta: { total: number };
};

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('Inventory (e2e)', () => {
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

  it('responde 401 sin sesión en todos los endpoints de inventario', async () => {
    await request(server()).get('/api/v1/inventory/movements').expect(401);
    await request(server())
      .post('/api/v1/inventory/movements')
      .send({ productId: UNKNOWN_UUID, type: 'ENTRY', quantity: 1 })
      .expect(401);
    await request(server()).get('/api/v1/inventory/low-stock').expect(401);
    await request(server()).get('/api/v1/inventory/summary').expect(401);
    await request(server())
      .get(`/api/v1/products/${UNKNOWN_UUID}/stock-movements`)
      .expect(401);
  });

  it('registra una entrada y recalcula el costo promedio ponderado', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-001',
      barcode: '7701000000011',
      name: 'Agua Cristal 600 ml',
      stock: 10,
      costPrice: 1000,
      salePrice: 2000,
      minStock: 24,
    });
    const agent = await loginAs(app);

    const response = await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ENTRY',
        quantity: 10,
        unitCost: 2000,
        reason: '  Compra a proveedor DistriColombia  ',
      })
      .expect(201);

    const movement = response.body as MovementBody;

    expect(movement).toMatchObject({
      productId: product.id,
      type: 'ENTRY',
      quantity: 10,
      previousStock: 10,
      newStock: 20,
      unitCost: 2000,
      reason: 'Compra a proveedor DistriColombia',
      saleId: null,
    });
    expect(movement.product).toEqual({
      id: product.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
    });
    expect(movement.user).toEqual({
      id: adminId,
      name: expect.any(String),
      email: ADMIN_CREDENTIALS.email,
    });

    const stored = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(stored.stock).toBe(20);
    expect(stored.costPrice.toNumber()).toBe(1500);

    const history = await agent
      .get(`/api/v1/products/${product.id}/price-history`)
      .expect(200);

    const historyBody = history.body as HistoryBody;

    expect(historyBody.meta.total).toBe(1);
    expect(historyBody.data[0]).toMatchObject({
      field: 'COST',
      oldValue: 1000,
      newValue: 1500,
    });
  });

  it('responde 400 con cantidades y tipos inválidos, y 404 si el producto no existe', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      stock: 10,
      costPrice: 1000,
      minStock: 5,
    });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: product.id, type: 'ENTRY', quantity: 0 })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: product.id, type: 'ENTRY', quantity: -5 })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: product.id, type: 'ENTRY', quantity: 2.5 })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: product.id, type: 'SALE', quantity: 4 })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'VOID',
        quantity: -4,
        reason: 'Anulación manual',
      })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: product.id, type: 'ENTRY', quantity: 4, stock: 99 })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: UNKNOWN_UUID, type: 'ENTRY', quantity: 4 })
      .expect(404);

    expect(await client.stockMovement.count()).toBe(0);

    const stored = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(stored.stock).toBe(10);
  });

  it('ajusta el stock a la baja exigiendo motivo y rechaza el negativo', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      stock: 10,
      costPrice: 1000,
      minStock: 5,
    });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/inventory/movements')
      .send({ productId: product.id, type: 'ADJUSTMENT', quantity: -4 })
      .expect(400);
    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: -4,
        reason: '   ',
      })
      .expect(400);

    const response = await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: -4,
        unitCost: 999_000,
        reason: 'Empaques rotos en bodega',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: -4,
      previousStock: 10,
      newStock: 6,
      unitCost: 1000,
      reason: 'Empaques rotos en bodega',
    });

    const stored = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(stored.stock).toBe(6);
    expect(stored.costPrice.toNumber()).toBe(1000);

    const conflict = await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: -10,
        reason: 'Conteo físico',
      })
      .expect(409);

    expect(conflict.body).toMatchObject({
      message: expect.stringContaining('Stock insuficiente'),
    });

    const after = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(after.stock).toBe(6);
    expect(await client.stockMovement.count()).toBe(1);
  });

  it('lista los movimientos con filtros de producto, tipo y fecha', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
      stock: 5,
      costPrice: 1000,
      minStock: 2,
    });
    const other = await createProduct(client, {
      categoryId: category.id,
      sku: 'SNK-001',
      name: 'Papas Margarita Pollo 105 g',
      stock: 5,
      costPrice: 1800,
      minStock: 2,
    });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ENTRY',
        quantity: 10,
        unitCost: 1500,
        reason: 'Compra a proveedor',
      })
      .expect(201);
    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: -2,
        reason: 'Merma por empaque roto',
      })
      .expect(201);
    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: other.id,
        type: 'ENTRY',
        quantity: 3,
        unitCost: 1900,
      })
      .expect(201);

    const all = await agent.get('/api/v1/inventory/movements').expect(200);

    expect((all.body as PaginatedMovements).meta.total).toBe(3);

    const paged = await agent
      .get('/api/v1/inventory/movements')
      .query({ page: 1, pageSize: 2 })
      .expect(200);

    expect((paged.body as PaginatedMovements).meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect((paged.body as PaginatedMovements).data).toHaveLength(2);

    const byProduct = await agent
      .get('/api/v1/inventory/movements')
      .query({ productId: product.id })
      .expect(200);

    const byProductBody = byProduct.body as PaginatedMovements;

    expect(byProductBody.meta.total).toBe(2);
    expect(byProductBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ENTRY',
          previousStock: 5,
          newStock: 15,
          unitCost: 1500,
        }),
        expect.objectContaining({
          type: 'ADJUSTMENT',
          previousStock: 15,
          newStock: 13,
          unitCost: 1333.33,
        }),
      ]),
    );
    expect(byProductBody.data[0]?.product).toEqual({
      id: product.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
    });

    const byType = await agent
      .get('/api/v1/inventory/movements')
      .query({ type: 'ENTRY' })
      .expect(200);

    const byTypeBody = byType.body as PaginatedMovements;

    expect(byTypeBody.meta.total).toBe(2);
    expect(byTypeBody.data.every((movement) => movement.type === 'ENTRY')).toBe(
      true,
    );
    expect(byTypeBody.data.every((movement) => movement.saleId === null)).toBe(
      true,
    );

    const inRange = await agent
      .get('/api/v1/inventory/movements')
      .query({
        from: '2000-01-01T00:00:00.000Z',
        to: '2100-01-01T00:00:00.000Z',
      })
      .expect(200);

    expect((inRange.body as PaginatedMovements).meta.total).toBe(3);

    const outOfRange = await agent
      .get('/api/v1/inventory/movements')
      .query({
        from: '2000-01-01T00:00:00.000Z',
        to: '2000-01-02T00:00:00.000Z',
      })
      .expect(200);

    expect((outOfRange.body as PaginatedMovements).meta.total).toBe(0);

    await agent
      .get('/api/v1/inventory/movements')
      .query({ from: 'ayer' })
      .expect(400);
    await agent
      .get('/api/v1/inventory/movements')
      .query({ type: 'REFUND' })
      .expect(400);
    await agent
      .get('/api/v1/inventory/movements')
      .query({ foo: '1' })
      .expect(400);
  });

  it('devuelve solo los productos críticos con su déficit', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });

    await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-001',
      name: 'Sin stock',
      stock: 0,
      minStock: 3,
      costPrice: 1000,
      salePrice: 2000,
      unit: 'botella',
    });
    await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-002',
      name: 'Crítico',
      stock: 1,
      minStock: 5,
      costPrice: 1200,
      salePrice: 2400,
      unit: 'botella',
    });
    await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-003',
      name: 'Suficiente',
      stock: 10,
      minStock: 2,
      costPrice: 1000,
      salePrice: 2000,
    });
    await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-004',
      name: 'Inactivo crítico',
      stock: 0,
      minStock: 9,
      active: false,
      costPrice: 1000,
      salePrice: 2000,
    });
    await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-005',
      name: 'Eliminado crítico',
      stock: 0,
      minStock: 9,
      deletedAt: new Date(),
      costPrice: 1000,
      salePrice: 2000,
    });

    const agent = await loginAs(app);
    const response = await agent
      .get('/api/v1/inventory/low-stock')
      .expect(200);

    const body = response.body as PaginatedLowStock;

    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(body.data.map((item) => item.name)).toEqual([
      'Sin stock',
      'Crítico',
    ]);
    expect(body.data[0]).toMatchObject({
      sku: 'BEB-001',
      stock: 0,
      minStock: 3,
      deficit: 3,
      costPrice: 1000,
      inventoryValue: 0,
      lowStock: true,
    });
    expect(body.data[1]).toMatchObject({
      sku: 'BEB-002',
      stock: 1,
      minStock: 5,
      deficit: 4,
      unit: 'botella',
      costPrice: 1200,
      inventoryValue: 1200,
    });
    expect(body.data[0]?.category).toEqual({
      id: category.id,
      name: 'Bebidas',
    });

    const bySearch = await agent
      .get('/api/v1/inventory/low-stock')
      .query({ search: 'críti' })
      .expect(200);

    expect((bySearch.body as PaginatedLowStock).meta.total).toBe(1);
    expect((bySearch.body as PaginatedLowStock).data[0]?.name).toBe('Crítico');

    const byCategory = await agent
      .get('/api/v1/inventory/low-stock')
      .query({ pageSize: 1, categoryId: category.id })
      .expect(200);

    expect((byCategory.body as PaginatedLowStock).meta).toMatchObject({
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: true,
    });

    const empty = await agent
      .get('/api/v1/inventory/low-stock')
      .query({ categoryId: UNKNOWN_UUID })
      .expect(200);

    expect((empty.body as PaginatedLowStock).meta).toMatchObject({
      total: 0,
      totalPages: 0,
      hasNextPage: false,
    });
  });

  it('resume unidades, valorización y alertas del inventario activo', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });

    await createProduct(client, {
      categoryId: category.id,
      stock: 10,
      minStock: 24,
      costPrice: 1000,
      salePrice: 2000,
    });
    await createProduct(client, {
      categoryId: category.id,
      stock: 0,
      minStock: 5,
      costPrice: 2000,
      salePrice: 4000,
    });
    await createProduct(client, {
      categoryId: category.id,
      stock: 40,
      minStock: 5,
      costPrice: 500,
      salePrice: 1000,
    });
    await createProduct(client, {
      categoryId: category.id,
      stock: 5,
      minStock: 5,
      active: false,
      costPrice: 100,
      salePrice: 200,
    });
    await createProduct(client, {
      categoryId: category.id,
      stock: 5,
      minStock: 5,
      deletedAt: new Date(),
      costPrice: 100,
      salePrice: 200,
    });

    const agent = await loginAs(app);
    const response = await agent.get('/api/v1/inventory/summary').expect(200);

    const summary = response.body as SummaryBody;

    expect(summary).toMatchObject({
      totalProducts: 3,
      totalUnits: 50,
      inventoryValue: 30_000,
      lowStockCount: 2,
      outOfStockCount: 1,
    });
    expect(Number.isNaN(Date.parse(summary.generatedAt))).toBe(false);

    const movements = await agent
      .get('/api/v1/inventory/movements')
      .expect(200);

    expect((movements.body as PaginatedMovements).meta.total).toBe(0);
  });

  it('expone el historial de stock de un producto paginado', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const product = await createProduct(client, {
      categoryId: category.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
      stock: 5,
      costPrice: 1000,
      minStock: 2,
    });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ENTRY',
        quantity: 5,
        unitCost: 1200,
        reason: 'Compra a proveedor',
      })
      .expect(201);
    await agent
      .post('/api/v1/inventory/movements')
      .send({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: -1,
        reason: 'Merma por empaque roto',
      })
      .expect(201);

    const response = await agent
      .get(`/api/v1/products/${product.id}/stock-movements`)
      .query({ page: 1, pageSize: 1 })
      .expect(200);

    const body = response.body as PaginatedMovements;

    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(body.data).toHaveLength(1);

    const entries = await agent
      .get(`/api/v1/products/${product.id}/stock-movements`)
      .query({ type: 'ENTRY' })
      .expect(200);

    const entriesBody = entries.body as PaginatedMovements;

    expect(entriesBody.meta.total).toBe(1);
    expect(entriesBody.data[0]).toMatchObject({
      type: 'ENTRY',
      quantity: 5,
      previousStock: 5,
      newStock: 10,
      unitCost: 1200,
      saleId: null,
    });
    expect(entriesBody.data[0]?.product).toEqual({
      id: product.id,
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
    });
    expect(entriesBody.data[0]?.user).toEqual({
      id: adminId,
      name: expect.any(String),
      email: ADMIN_CREDENTIALS.email,
    });

    await agent
      .get(`/api/v1/products/${UNKNOWN_UUID}/stock-movements`)
      .expect(404);
    await agent
      .get('/api/v1/products/not-a-uuid/stock-movements')
      .expect(400);
    await agent
      .get(`/api/v1/products/${product.id}/stock-movements`)
      .query({ type: 'REFUND' })
      .expect(400);

    await agent.delete(`/api/v1/products/${product.id}`).expect(204);
    await agent
      .get(`/api/v1/products/${product.id}/stock-movements`)
      .expect(404);
  });
});
