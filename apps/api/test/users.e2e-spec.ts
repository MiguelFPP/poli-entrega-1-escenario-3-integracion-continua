import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Role, type PrismaClient } from '../src/generated/prisma/client.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import { createUser } from '../prisma/factories/index.js';
import { ADMIN_CREDENTIALS, loginAs } from './auth-client.js';
import { resetDatabase, setupTestDatabase } from './db.js';

describe('Users (e2e)', () => {
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

  it('GET /users responde 401 sin sesión', async () => {
    await request(server()).get('/api/v1/users').expect(401);
  });

  it('GET /users responde 403 a un usuario que no es ADMIN', async () => {
    await createUser(client, {
      email: 'cajera@pos.local',
      role: Role.CASHIER,
    });
    const agent = await loginAs(app, {
      email: 'cajera@pos.local',
      password: 'Password123!',
    });

    await agent.get('/api/v1/users').expect(403);
  });

  it('GET /users lista paginado y sin passwordHash', async () => {
    await createUser(client, { name: 'Cajera Uno', email: 'uno@pos.local' });
    await createUser(client, {
      name: 'Cajera Dos',
      email: 'dos@pos.local',
      active: false,
    });
    const agent = await loginAs(app);

    const response = await agent
      .get('/api/v1/users')
      .query({ page: 1, pageSize: 2 })
      .expect(200);

    expect(response.body.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(response.body.data).toHaveLength(2);

    for (const user of response.body.data as Array<Record<string, unknown>>) {
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).toHaveProperty('id');
    }
  });

  it('GET /users filtra por búsqueda y estado', async () => {
    await createUser(client, { name: 'Cajera Uno', email: 'uno@pos.local' });
    await createUser(client, {
      name: 'Bodeguero',
      email: 'bodega@pos.local',
      active: false,
    });
    const agent = await loginAs(app);

    const inactive = await agent
      .get('/api/v1/users')
      .query({ active: 'false' })
      .expect(200);

    expect(inactive.body.meta.total).toBe(1);
    expect(inactive.body.data[0]).toMatchObject({ email: 'bodega@pos.local' });

    const search = await agent
      .get('/api/v1/users')
      .query({ search: 'CAJERA' })
      .expect(200);

    expect(search.body.meta.total).toBe(1);
    expect(search.body.data[0]).toMatchObject({ name: 'Cajera Uno' });
  });

  it('POST /users crea un ADMIN con email normalizado y contraseña hasheada', async () => {
    const agent = await loginAs(app);

    const response = await agent
      .post('/api/v1/users')
      .send({
        name: 'Cajera Turno Mañana',
        email: '  CAJERA@POS.LOCAL ',
        password: 'Cajera2026!',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Cajera Turno Mañana',
      email: 'cajera@pos.local',
      role: 'ADMIN',
      active: true,
    });
    expect(response.body).not.toHaveProperty('passwordHash');

    const stored = await client.user.findUnique({
      where: { email: 'cajera@pos.local' },
    });

    expect(stored?.passwordHash).not.toBe('Cajera2026!');
    expect(
      await bcrypt.compare('Cajera2026!', stored?.passwordHash ?? ''),
    ).toBe(true);
  });

  it('POST /users responde 409 con email duplicado', async () => {
    await createUser(client, { email: 'duplicado@pos.local' });
    const agent = await loginAs(app);

    const response = await agent
      .post('/api/v1/users')
      .send({
        name: 'Duplicado',
        email: 'DUPLICADO@pos.local',
        password: 'Duplicado2026!',
      })
      .expect(409);

    expect(response.body).toMatchObject({
      message: 'Ya existe un usuario con ese email',
    });
  });

  it('POST /users valida el payload', async () => {
    const agent = await loginAs(app);

    await agent
      .post('/api/v1/users')
      .send({ name: 'X', email: 'no-es-email', password: 'debil' })
      .expect(400);
  });

  it('PATCH /users/:id actualiza nombre y email', async () => {
    const target = await createUser(client, { email: 'editable@pos.local' });
    const agent = await loginAs(app);

    const response = await agent
      .patch(`/api/v1/users/${target.id}`)
      .send({ name: 'Nombre Nuevo', email: 'nuevo@pos.local' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: target.id,
      name: 'Nombre Nuevo',
      email: 'nuevo@pos.local',
    });
  });

  it('PATCH /users/:id responde 409 si el email ya existe', async () => {
    await createUser(client, { email: 'ocupado@pos.local' });
    const target = await createUser(client, { email: 'libre@pos.local' });
    const agent = await loginAs(app);

    await agent
      .patch(`/api/v1/users/${target.id}`)
      .send({ email: 'ocupado@pos.local' })
      .expect(409);
  });

  it('PATCH /users/:id/password cambia la contraseña y cierra sesiones', async () => {
    const target = await createUser(client, { email: 'clave@pos.local' });
    const agent = await loginAs(app);

    await agent
      .patch(`/api/v1/users/${target.id}/password`)
      .send({ password: 'Nueva2026!' })
      .expect(204);

    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'clave@pos.local', password: 'Nueva2026!' })
      .expect(200);

    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'clave@pos.local', password: 'Password123!' })
      .expect(401);
  });

  it('PATCH /users/:id/password valida la política de contraseña', async () => {
    const target = await createUser(client, { email: 'clave@pos.local' });
    const agent = await loginAs(app);

    const response = await agent
      .patch(`/api/v1/users/${target.id}/password`)
      .send({ password: 'sindigitos' })
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
  });

  it('PATCH /users/:id/deactivate desactiva y bloquea el login', async () => {
    const target = await createUser(client, { email: 'salida@pos.local' });
    const agent = await loginAs(app);

    const response = await agent
      .patch(`/api/v1/users/${target.id}/deactivate`)
      .expect(200);

    expect(response.body).toMatchObject({ id: target.id, active: false });

    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'salida@pos.local', password: 'Password123!' })
      .expect(401);
  });

  it('PATCH /users/:id/deactivate impide autodesactivarse', async () => {
    const agent = await loginAs(app);

    const response = await agent
      .patch(`/api/v1/users/${adminId}/deactivate`)
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'No puedes desactivar tu propio usuario',
    });
  });

  it('PATCH /users/:id responde 404 con un UUID inexistente', async () => {
    const agent = await loginAs(app);

    await agent
      .patch('/api/v1/users/00000000-0000-4000-8000-000000000000')
      .send({ name: 'Fantasma' })
      .expect(404);
  });

  it('PATCH /users/:id valida que el id sea UUID', async () => {
    const agent = await loginAs(app);

    await agent
      .patch('/api/v1/users/no-es-uuid')
      .send({ name: 'Fantasma' })
      .expect(400);
  });
});
