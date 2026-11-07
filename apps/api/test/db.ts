import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../prisma/client.js';
import { truncateBusinessData } from '../prisma/truncate.js';

/** Cliente Prisma apuntando a la base de pruebas (DATABASE_URL). */
export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient(process.env.DATABASE_URL);
}

/** Deja la base limpia y el consecutivo de ventas en 1. */
export async function resetDatabase(client: PrismaClient): Promise<void> {
  await truncateBusinessData(client);
}

/** Conecta y limpia la base; pensado para `beforeAll`. */
export async function setupTestDatabase(): Promise<PrismaClient> {
  const client = createTestPrismaClient();
  await client.$connect();
  await resetDatabase(client);
  return client;
}
