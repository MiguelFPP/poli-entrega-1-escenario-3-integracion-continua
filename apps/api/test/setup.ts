import 'reflect-metadata';

// Secretos de desarrollo para pruebas: `validateEnv` exige 32+ caracteres.
const TEST_SECRETS = {
  JWT_ACCESS_SECRET: 'test-access-secret-0000000000000000000000',
  JWT_REFRESH_SECRET: 'test-refresh-secret-000000000000000000000',
  WEB_ORIGIN: 'http://localhost:3000',
} as const;

for (const [key, value] of Object.entries(TEST_SECRETS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
