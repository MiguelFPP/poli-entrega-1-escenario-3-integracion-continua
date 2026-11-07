import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Role, type PrismaClient } from '../src/generated/prisma/client.js';
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

type CategoryBody = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  productCount: number;
};

describe('Categories (e2e)', () => {
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

  it('GET /categories responde 401 sin sesión', async () => {
    await request(server()).get('/api/v1/categories').expect(401);
  });

  it('GET /categories responde 403 a un usuario que no es ADMIN', async () => {
    await createUser(client, {
      email: 'cajera@pos.local',
      role: Role.CASHIER,
    });
    const agent = await loginAs(app, {
      email: 'cajera@pos.local',
      password: 'Password123!',
    });

    await agent.get('/api/v1/categories').expect(403);
  });

  it('crea, lista y actualiza categorías', async () => {
    const agent = await loginAs(app);

    const created = await agent
      .post('/api/v1/categories')
      .send({ name: '  Bebidas  ', description: 'Bebidas frías y calientes' })
      .expect(201);

    const category = created.body as CategoryBody;

    expect(category).toMatchObject({
      name: 'Bebidas',
      description: 'Bebidas frías y calientes',
      active: true,
      productCount: 0,
    });

    await createProduct(client, { categoryId: category.id, active: true });

    const listed = await agent.get('/api/v1/categories').expect(200);
    const categories = listed.body as CategoryBody[];

    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      id: category.id,
      name: 'Bebidas',
      productCount: 1,
    });

    const updated = await agent
      .patch(`/api/v1/categories/${category.id}`)
      .send({ name: 'Bebidas y jugos', description: 'Bebidas y jugos' })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: category.id,
      name: 'Bebidas y jugos',
      description: 'Bebidas y jugos',
    });
  });

  it('ordena por nombre y filtra por búsqueda y estado', async () => {
    await createCategory(client, { name: 'Zumos' });
    await createCategory(client, { name: 'Abarrotes' });
    await createCategory(client, { name: 'Aseo', active: false });
    const agent = await loginAs(app);

    const ordered = await agent.get('/api/v1/categories').expect(200);
    const names = (ordered.body as CategoryBody[]).map(
      (category) => category.name,
    );

    expect(names).toEqual(['Abarrotes', 'Aseo', 'Zumos']);

    const search = await agent
      .get('/api/v1/categories')
      .query({ search: 'ZU' })
      .expect(200);

    expect((search.body as CategoryBody[]).map((c) => c.name)).toEqual([
      'Zumos',
    ]);

    const inactive = await agent
      .get('/api/v1/categories')
      .query({ active: 'false' })
      .expect(200);

    expect(inactive.body as CategoryBody[]).toEqual([
      expect.objectContaining({ name: 'Aseo', active: false }),
    ]);
  });

  it('POST /categories responde 409 con nombre duplicado sin distinguir mayúsculas', async () => {
    await createCategory(client, { name: 'Bebidas' });
    const agent = await loginAs(app);

    const response = await agent
      .post('/api/v1/categories')
      .send({ name: 'bebidas' })
      .expect(409);

    expect(response.body).toMatchObject({
      message: 'Ya existe una categoría con ese nombre',
    });
  });

  it('DELETE /categories/:id desactiva la categoría (borrado lógico)', async () => {
    const category = await createCategory(client, { name: 'Temporal' });
    const agent = await loginAs(app);

    const response = await agent
      .delete(`/api/v1/categories/${category.id}`)
      .expect(200);

    expect(response.body).toMatchObject({ id: category.id, active: false });

    const stored = await client.category.findUnique({
      where: { id: category.id },
    });

    expect(stored?.active).toBe(false);

    // Repetir el borrado es idempotente.
    await agent.delete(`/api/v1/categories/${category.id}`).expect(200);

    // La categoría inactiva no admite productos nuevos.
    await agent
      .post('/api/v1/products')
      .send({
        sku: 'TMP-001',
        name: 'Producto temporal',
        categoryId: category.id,
        costPrice: 1000,
        salePrice: 2000,
      })
      .expect(400);
  });

  it('DELETE /categories/:id responde 409 si tiene productos activos', async () => {
    const category = await createCategory(client, { name: 'Con productos' });
    await createProduct(client, { categoryId: category.id, active: true });
    const agent = await loginAs(app);

    const response = await agent
      .delete(`/api/v1/categories/${category.id}`)
      .expect(409);

    expect(response.body).toMatchObject({
      message: 'No se puede desactivar una categoría con productos activos',
    });
  });

  it('PATCH /categories/:id responde 404 con un UUID inexistente y 400 con id inválido', async () => {
    const agent = await loginAs(app);

    await agent
      .patch('/api/v1/categories/00000000-0000-4000-8000-000000000000')
      .send({ name: 'Fantasma' })
      .expect(404);

    await agent
      .patch('/api/v1/categories/no-es-uuid')
      .send({ name: 'Fantasma' })
      .expect(400);
  });
});
