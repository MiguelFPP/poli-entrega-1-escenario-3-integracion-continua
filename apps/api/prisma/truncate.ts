import type { PrismaClient } from '../src/generated/prisma/client.js';

/** Tablas de negocio en orden seguro para TRUNCATE (CASCADE igual funciona). */
export const BUSINESS_TABLES = [
  'stock_movements',
  'payments',
  'sale_items',
  'sales',
  'price_history',
  'refresh_tokens',
  'products',
  'categories',
  'users',
] as const;

type Executor = Pick<PrismaClient, '$executeRawUnsafe'>;

/** Vacía los datos de negocio y reinicia el consecutivo de ventas. */
export async function truncateBusinessData(client: Executor): Promise<void> {
  const tables = BUSINESS_TABLES.map((table) => `"${table}"`).join(', ');
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`,
  );
  await client.$executeRawUnsafe(
    'ALTER SEQUENCE sale_number_seq RESTART WITH 1;',
  );
}
