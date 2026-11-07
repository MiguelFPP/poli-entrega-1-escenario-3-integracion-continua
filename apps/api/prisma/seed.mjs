import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[seed] DATABASE_URL no está definida.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

try {
  const { rows } = await pool.query(
    'SELECT current_database() AS database, now() AS executed_at',
  );
  const { database, executed_at: executedAt } = rows[0];
  console.log(
    `[seed] Conexión correcta con "${database}" (${new Date(executedAt).toISOString()}).`,
  );
  console.log('[seed] Fase 0 no inserta datos de negocio.');
} catch (error) {
  console.error(
    '[seed] Error al conectar con PostgreSQL:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
