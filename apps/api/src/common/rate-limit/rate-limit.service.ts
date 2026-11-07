import { Injectable } from '@nestjs/common';

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Segundos que faltan para que la ventana se reinicie (0 si fue permitido). */
  retryAfterSeconds: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

/** Cada cuánto se limpian los contadores vencidos (evita crecer sin control). */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Contadores en memoria por clave (ruta + IP). Suficiente para un despliegue
 * de una sola instancia; en multi-instancia debería compartirse en Redis.
 */
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.sweepExpired(now);

    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        retryAfterSeconds: 0,
      };
    }

    current.count += 1;

    if (current.count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - now) / 1000),
        ),
      };
    }

    return {
      allowed: true,
      limit,
      remaining: limit - current.count,
      retryAfterSeconds: 0,
    };
  }

  /** Vacía los contadores (útil en pruebas e2e). */
  reset(): void {
    this.buckets.clear();
    this.lastSweep = Date.now();
  }

  private sweepExpired(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) {
      return;
    }

    this.lastSweep = now;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
