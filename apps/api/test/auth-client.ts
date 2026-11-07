import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Admin creado por el seed y por las pruebas. */
export const ADMIN_CREDENTIALS = {
  email: 'admin@pos.local',
  password: 'Admin123!',
} as const;

export type Credentials = {
  email: string;
  password: string;
};

export type TestAgent = ReturnType<typeof request.agent>;

/** Inicia sesión con un agente que conserva las cookies httpOnly. */
export async function loginAs(
  app: INestApplication,
  credentials: Credentials = ADMIN_CREDENTIALS,
): Promise<TestAgent> {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/v1/auth/login').send(credentials).expect(200);

  return agent;
}

/** Devuelve las cabeceras `Set-Cookie` de una respuesta. */
export function readSetCookies(response: {
  headers: Record<string, unknown>;
}): string[] {
  const header = response.headers['set-cookie'];

  if (Array.isArray(header)) {
    return header.filter((value): value is string => typeof value === 'string');
  }

  return typeof header === 'string' ? [header] : [];
}

/** Busca una cookie por nombre en las cabeceras `Set-Cookie`. */
export function findCookie(
  cookies: readonly string[],
  name: string,
): string | undefined {
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

/** Extrae el valor de una cookie; falla si no vino en la respuesta. */
export function requireCookie(
  cookies: readonly string[],
  name: string,
): string {
  const header = findCookie(cookies, name);

  if (!header) {
    throw new Error(`La respuesta no incluyó la cookie ${name}`);
  }

  const pair = header.split(';')[0] ?? '';
  const value = pair.slice(pair.indexOf('=') + 1);

  if (!value) {
    throw new Error(`La cookie ${name} llegó vacía`);
  }

  return value;
}

/** Cabecera `Cookie` con los tokens de una sesión recién creada. */
export async function cookieHeaderAfterLogin(
  app: INestApplication,
  credentials: Credentials = ADMIN_CREDENTIALS,
): Promise<{ header: string; accessToken: string; refreshToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send(credentials)
    .expect(200);

  const cookies = readSetCookies(response);
  const accessToken = requireCookie(cookies, 'access_token');
  const refreshToken = requireCookie(cookies, 'refresh_token');

  return {
    header: `access_token=${accessToken}; refresh_token=${refreshToken}`,
    accessToken,
    refreshToken,
  };
}
