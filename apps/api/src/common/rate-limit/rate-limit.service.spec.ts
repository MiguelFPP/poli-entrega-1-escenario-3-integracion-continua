import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { RateLimitService } from './rate-limit.service.js';

const BASE_TIME = new Date('2026-02-12T09:15:00.000Z').getTime();

function createClock() {
  const clock = { now: BASE_TIME };
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => clock.now);

  return {
    spy,
    advance: (ms: number): void => {
      clock.now += ms;
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RateLimitService.consume', () => {
  it('permite la primera petición de una ventana nueva', () => {
    createClock();
    const service = new RateLimitService();

    expect(service.consume('GET:/salud:127.0.0.1', 3, 1000)).toEqual({
      allowed: true,
      limit: 3,
      remaining: 2,
      retryAfterSeconds: 0,
    });
  });

  it('descuenta el remanente en peticiones sucesivas sin bloquear', () => {
    createClock();
    const service = new RateLimitService();

    expect(service.consume('k', 3, 1000).remaining).toBe(2);
    expect(service.consume('k', 3, 1000).remaining).toBe(1);
    expect(service.consume('k', 3, 1000).remaining).toBe(0);
  });

  it('bloquea al superar el límite con un Retry-After positivo', () => {
    createClock();
    const service = new RateLimitService();

    service.consume('k', 3, 1000);
    service.consume('k', 3, 1000);
    service.consume('k', 3, 1000);

    expect(service.consume('k', 3, 1000)).toEqual({
      allowed: false,
      limit: 3,
      remaining: 0,
      retryAfterSeconds: 1,
    });
  });

  it('abre una ventana nueva cuando la anterior expiró', () => {
    const clock = createClock();
    const service = new RateLimitService();

    service.consume('k', 1, 1000);
    clock.advance(1001);

    expect(service.consume('k', 1, 1000)).toEqual({
      allowed: true,
      limit: 1,
      remaining: 0,
      retryAfterSeconds: 0,
    });
  });

  it('barre los contadores vencidos al pasar el intervalo de limpieza', () => {
    const clock = createClock();
    const service = new RateLimitService();

    service.consume('k', 5, 1000);
    clock.advance(70_000);

    expect(service.consume('k', 5, 1000).remaining).toBe(4);
  });

  it('conserva los contadores que siguen vigentes durante el barrido', () => {
    const clock = createClock();
    const service = new RateLimitService();

    service.consume('k', 5, 200_000);
    clock.advance(70_000);

    const result = service.consume('k', 5, 200_000);

    expect(result).toMatchObject({ allowed: true, remaining: 3 });
  });
});

describe('RateLimitService.reset', () => {
  it('vacía los contadores acumulados', () => {
    createClock();
    const service = new RateLimitService();

    expect(service.consume('k', 2, 1000).remaining).toBe(1);

    service.reset();

    expect(service.consume('k', 2, 1000)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 0,
    });
  });
});
