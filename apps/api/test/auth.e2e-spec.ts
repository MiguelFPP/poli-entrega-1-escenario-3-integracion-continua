import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import { createUser } from '../prisma/factories/index.js';
import {
  ADMIN_CREDENTIALS,
  findCookie,
  loginAs,
  readSetCookies,
  requireCookie,
} from './auth-client.js';
import { resetDatabase, setupTestDatabase } from './db.js';

describe('Auth (e2e)', () => {
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

  it('POST /auth/login responde 200 con cookies httpOnly y sin tokens en el body', async () => {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(200);

    const cookies = readSetCookies(response);
    const access = findCookie(cookies, 'access_token');
    const refresh = findCookie(cookies, 'refresh_token');

    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(access).toContain('HttpOnly');
    expect(access).toContain('Path=/');
    expect(access).toContain('SameSite=Lax');
    expect(refresh).toContain('Path=/api/v1/auth');

    expect(response.body).toMatchObject({
      user: { email: ADMIN_CREDENTIALS.email, role: 'ADMIN', active: true },
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 604800,
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(
      requireCookie(cookies, 'access_token'),
    );
  });

  it('POST /auth/login responde 401 con contraseña incorrecta', async () => {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_CREDENTIALS.email, password: 'Incorrecta123!' })
      .expect(401);

    expect(response.body).toMatchObject({ message: 'Credenciales inválidas' });
    expect(readSetCookies(response)).toHaveLength(0);
  });

  it('POST /auth/login responde 401 con un usuario inactivo', async () => {
    await client.user.update({
      where: { email: ADMIN_CREDENTIALS.email },
      data: { active: false },
    });

    await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(401);
  });

  it('GET /auth/me responde 200 con la cookie de sesión', async () => {
    const agent = await loginAs(app);

    const response = await agent.get('/api/v1/auth/me').expect(200);

    expect(response.body).toMatchObject({
      email: ADMIN_CREDENTIALS.email,
      role: 'ADMIN',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('GET /auth/me responde 401 sin cookie', async () => {
    await request(server()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me acepta Authorization: Bearer', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(200);

    const accessToken = requireCookie(readSetCookies(login), 'access_token');

    await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('POST /auth/refresh rota la cookie y el token anterior deja de servir', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(200);

    const previous = requireCookie(readSetCookies(login), 'refresh_token');

    const rotated = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${previous}`)
      .expect(200);

    const current = requireCookie(readSetCookies(rotated), 'refresh_token');

    expect(current).not.toBe(previous);

    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${previous}`)
      .expect(401);
  });

  it('POST /auth/refresh detecta reuso y revoca todas las sesiones', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(200);
    const first = requireCookie(readSetCookies(login), 'refresh_token');

    const rotated = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${first}`)
      .expect(200);
    const second = requireCookie(readSetCookies(rotated), 'refresh_token');

    // Reutilizar un token ya revocado invalida la sesión nueva también.
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${first}`)
      .expect(401);

    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${second}`)
      .expect(401);
  });

  it('POST /auth/refresh responde 401 sin cookie', async () => {
    await request(server()).post('/api/v1/auth/refresh').expect(401);
  });

  it('POST /auth/logout limpia las cookies y revoca el refresh', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(200);
    const cookies = readSetCookies(login);
    const refreshToken = requireCookie(cookies, 'refresh_token');

    const logout = await request(server())
      .post('/api/v1/auth/logout')
      .set(
        'Cookie',
        `access_token=${requireCookie(cookies, 'access_token')}; refresh_token=${refreshToken}`,
      )
      .expect(204);

    const cleared = readSetCookies(logout);
    expect(findCookie(cleared, 'access_token')).toContain('access_token=;');
    expect(findCookie(cleared, 'refresh_token')).toContain('refresh_token=;');

    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .expect(401);
  });

  it('POST /auth/login responde 429 al sexto intento por minuto', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server())
        .post('/api/v1/auth/login')
        .send(ADMIN_CREDENTIALS)
        .expect(200);
    }

    const blocked = await request(server())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDENTIALS)
      .expect(429);

    expect(blocked.body).toMatchObject({ statusCode: 429 });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rechaza mutaciones con Origin distinto de WEB_ORIGIN', async () => {
    await request(server())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://evil.example')
      .send(ADMIN_CREDENTIALS)
      .expect(403);

    await request(server())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send(ADMIN_CREDENTIALS)
      .expect(200);
  });
});
