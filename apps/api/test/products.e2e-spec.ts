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

type ProductBody = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  active: boolean;
  lowStock: boolean;
};

type PaginatedProducts = {
  data: ProductBody[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

function payload(
  categoryId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sku: 'BEB-001',
    barcode: '7701000000011',
    name: 'Agua Cristal 600 ml',
    description: 'Agua purificada sin gas',
    categoryId,
    costPrice: 1200,
    salePrice: 2000,
    minStock: 24,
    unit: 'botella',
    ...overrides,
  };
}

describe('Products (e2e)', () => {
  let app: INestApplication;
  let client: PrismaClient;
  let rateLimit: RateLimitService;

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

  it('GET /products responde 401 sin sesión', async () => {
    await request(server()).get('/api/v1/products').expect(401);
  });

  it('crea productos con stock 0 y los lista paginados y ordenados', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/products')
      .send(payload(category.id, { sku: 'BEB-003', barcode: '7701000000035', name: 'Pan tajado', salePrice: 1000 }))
      .expect(201);
    await agent
      .post('/api/v1/products')
      .send(payload(category.id, { sku: 'BEB-001', barcode: '7701000000011', name: 'Agua Cristal', salePrice: 2000 }))
      .expect(201);
    await agent
      .post('/api/v1/products')
      .send(payload(category.id, { sku: 'BEB-002', barcode: '7701000000028', name: 'Café molido', salePrice: 5000 }))
      .expect(201);

    const response = await agent
      .get('/api/v1/products')
      .query({ page: 1, pageSize: 2, sort: 'name', order: 'asc' })
      .expect(200);

    const body = response.body as PaginatedProducts;

    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(body.data.map((product) => product.name)).toEqual([
      'Agua Cristal',
      'Café molido',
    ]);
    expect(body.data[0]?.stock).toBe(0);
  });

  it('filtra por categoría, búsqueda, estado y ordena por precio', async () => {
    const bebidas = await createCategory(client, { name: 'Bebidas' });
    const snacks = await createCategory(client, { name: 'Snacks' });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/products')
      .send(payload(bebidas.id, { sku: 'BEB-001', barcode: '7701000000011', name: 'Agua Cristal', salePrice: 2000 }))
      .expect(201);
    await agent
      .post('/api/v1/products')
      .send(payload(bebidas.id, { sku: 'BEB-002', barcode: '7701000000028', name: 'Gaseosa', salePrice: 3500 }))
      .expect(201);
    await agent
      .post('/api/v1/products')
      .send(payload(snacks.id, { sku: 'SNK-001', barcode: '7701000000099', name: 'Papas', salePrice: 3000 }))
      .expect(201);

    await createProduct(client, {
      categoryId: snacks.id,
      name: 'Producto inactivo',
      active: false,
      costPrice: 500,
      salePrice: 500,
    });

    const byCategory = await agent
      .get('/api/v1/products')
      .query({ categoryId: snacks.id })
      .expect(200);

    expect((byCategory.body as PaginatedProducts).meta.total).toBe(2);

    const bySearch = await agent
      .get('/api/v1/products')
      .query({ search: 'GASE' })
      .expect(200);

    expect((bySearch.body as PaginatedProducts).data[0]).toMatchObject({
      sku: 'BEB-002',
    });

    const bySku = await agent
      .get('/api/v1/products')
      .query({ search: 'SNK-001' })
      .expect(200);

    expect((bySku.body as PaginatedProducts).meta.total).toBe(1);

    const inactive = await agent
      .get('/api/v1/products')
      .query({ active: 'false' })
      .expect(200);

    expect((inactive.body as PaginatedProducts).data).toEqual([
      expect.objectContaining({ name: 'Producto inactivo', active: false }),
    ]);

    const sorted = await agent
      .get('/api/v1/products')
      .query({ sort: 'salePrice', order: 'desc' })
      .expect(200);

    expect((sorted.body as PaginatedProducts).data[0]).toMatchObject({
      salePrice: 3500,
    });
  });

  it('GET /products/:id devuelve el detalle con su categoría', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    const created = await agent
      .post('/api/v1/products')
      .send(payload(category.id))
      .expect(201);

    const product = created.body as ProductBody;

    const response = await agent
      .get(`/api/v1/products/${product.id}`)
      .expect(200);

    const detail = response.body as ProductBody;

    expect(detail).toMatchObject({
      id: product.id,
      sku: 'BEB-001',
      stock: 0,
      lowStock: true,
    });
    expect(detail.category).toEqual({ id: category.id, name: 'Bebidas' });

    await agent
      .get('/api/v1/products/00000000-0000-4000-8000-000000000000')
      .expect(404);
  });

  it('PATCH /products/:id actualiza el catálogo y registra el precio', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    const created = await agent
      .post('/api/v1/products')
      .send(payload(category.id))
      .expect(201);

    const product = created.body as ProductBody;

    const response = await agent
      .patch(`/api/v1/products/${product.id}`)
      .send({
        name: 'Agua Cristal 600 ml (nueva)',
        salePrice: 2500,
        minStock: 30,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: product.id,
      name: 'Agua Cristal 600 ml (nueva)',
      salePrice: 2500,
      minStock: 30,
      stock: 0,
    });

    // El stock no se edita desde el catálogo.
    await agent
      .patch(`/api/v1/products/${product.id}`)
      .send({ stock: 15 })
      .expect(400);
  });

  it('POST /products responde 409 con SKU o código de barras duplicado', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/products')
      .send(payload(category.id))
      .expect(201);

    const duplicateSku = await agent
      .post('/api/v1/products')
      .send(
        payload(category.id, {
          sku: 'beb-001',
          barcode: '7701000000099',
          name: 'Otra agua',
        }),
      )
      .expect(409);

    expect(duplicateSku.body).toMatchObject({
      message: 'Ya existe un producto con ese SKU',
    });

    const duplicateBarcode = await agent
      .post('/api/v1/products')
      .send(
        payload(category.id, {
          sku: 'BEB-002',
          barcode: '7701000000011',
          name: 'Otra gaseosa',
        }),
      )
      .expect(409);

    expect(duplicateBarcode.body).toMatchObject({
      message: 'Ya existe un producto con ese código de barras',
    });
  });

  it('POST /products responde 400 si incluye stock', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/products')
      .send(payload(category.id, { stock: 10 }))
      .expect(400);
  });

  it('POST /products responde 400 con categoría inactiva o inexistente', async () => {
    const inactive = await createCategory(client, {
      name: 'Inactiva',
      active: false,
    });
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/products')
      .send(payload(inactive.id))
      .expect(400);

    await agent
      .post('/api/v1/products')
      .send(
        payload('00000000-0000-4000-8000-000000000000', {
          barcode: '7701000000077',
        }),
      )
      .expect(400);
  });

  it('DELETE /products/:id aplica borrado lógico idempotente', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    const created = await agent
      .post('/api/v1/products')
      .send(payload(category.id))
      .expect(201);

    const product = created.body as ProductBody;

    await agent.delete(`/api/v1/products/${product.id}`).expect(204);
    await agent.delete(`/api/v1/products/${product.id}`).expect(204);

    const stored = await client.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.active).toBe(false);
    expect(stored?.deletedAt).not.toBeNull();

    await agent.get(`/api/v1/products/${product.id}`).expect(404);

    const listed = await agent.get('/api/v1/products').expect(200);

    expect((listed.body as PaginatedProducts).data).toHaveLength(0);
  });

  it('filtra productos con stock bajo', async () => {
    const category = await createCategory(client, { name: 'Bebidas' });
    await createProduct(client, {
      categoryId: category.id,
      name: 'Stock crítico',
      stock: 1,
      minStock: 5,
    });
    await createProduct(client, {
      categoryId: category.id,
      name: 'Stock suficiente',
      stock: 10,
      minStock: 2,
    });
    const agent = await loginAs(app);

    const low = await agent
      .get('/api/v1/products')
      .query({ lowStock: 'true' })
      .expect(200);

    const lowBody = low.body as PaginatedProducts;

    expect(lowBody.meta.total).toBe(1);
    expect(lowBody.data[0]).toMatchObject({
      name: 'Stock crítico',
      stock: 1,
      minStock: 5,
      lowStock: true,
    });

    const healthy = await agent
      .get('/api/v1/products')
      .query({ lowStock: 'false' })
      .expect(200);

    expect((healthy.body as PaginatedProducts).data).toEqual([
      expect.objectContaining({ name: 'Stock suficiente', lowStock: false }),
    ]);
  });
});
