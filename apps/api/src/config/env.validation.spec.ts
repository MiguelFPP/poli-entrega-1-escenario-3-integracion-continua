import { describe, expect, it } from '@jest/globals';
import { validateEnv } from './env.validation.js';
import { DEFAULT_WEB_ORIGIN } from './web-origin.js';

const DATABASE_URL = 'postgresql://pos:pos@localhost:5432/pos_test';

function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL,
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('acepta una configuración válida y aplica los valores por defecto', () => {
    const result = validateEnv(validRaw());

    expect(result.DATABASE_URL).toBe(DATABASE_URL);
    expect(result.PORT).toBe(3001);
    expect(result.WEB_ORIGIN).toBe(DEFAULT_WEB_ORIGIN);
  });

  it('convierte PORT de texto a número', () => {
    const result = validateEnv(validRaw({ PORT: '4000' }));

    expect(result.PORT).toBe(4000);
  });

  it('conserva una lista de WEB_ORIGIN separada por comas', () => {
    const result = validateEnv(
      validRaw({ WEB_ORIGIN: 'http://localhost:4100, http://panel.local' }),
    );

    expect(result.WEB_ORIGIN).toBe('http://localhost:4100, http://panel.local');
  });

  it('falla cuando falta DATABASE_URL', () => {
    expect(() =>
      validateEnv({
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('falla cuando falta un secreto JWT', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL,
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('falla cuando un secreto es más corto que 32 caracteres', () => {
    expect(() => validateEnv(validRaw({ JWT_REFRESH_SECRET: 'corto' }))).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });

  it('falla cuando WEB_ORIGIN no es una URL http(s)', () => {
    expect(() => validateEnv(validRaw({ WEB_ORIGIN: 'no-es-una-url' }))).toThrow(
      /WEB_ORIGIN/,
    );
  });

  it('falla cuando PORT está fuera de rango', () => {
    expect(() => validateEnv(validRaw({ PORT: '70000' }))).toThrow(/PORT/);
  });
});
