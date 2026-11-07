import type { ConfigService } from '@nestjs/config';

/** Origen del frontend por defecto en desarrollo. */
export const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/**
 * Orígenes permitidos por CORS y por el guard de `Origin`.
 * `WEB_ORIGIN` admite una lista separada por comas.
 */
export function webOrigins(config: ConfigService): string[] {
  const raw = config.get<string>('WEB_ORIGIN')?.trim() ?? '';
  const value = raw.length > 0 ? raw : DEFAULT_WEB_ORIGIN;

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : [DEFAULT_WEB_ORIGIN];
}
