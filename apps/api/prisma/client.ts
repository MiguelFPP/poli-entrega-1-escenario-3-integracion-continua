import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Crea un PrismaClient independiente para seeds y tests.
 * No usa el PrismaService de Nest para poder ejecutarse fuera de la app.
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error('[prisma] DATABASE_URL no está definida');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Cierra la conexión ignorando errores de apagado. */
export async function disconnectQuietly(client: PrismaClient): Promise<void> {
  try {
    await client.$disconnect();
  } catch {
    // El proceso termina igual; no interesa el error de desconexión.
  }
}
