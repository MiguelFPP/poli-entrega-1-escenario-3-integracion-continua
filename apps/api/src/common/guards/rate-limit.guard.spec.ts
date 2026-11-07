import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import {
  HttpException,
  HttpStatus,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import {
  THROTTLE_KEY,
  type ThrottleOptions,
} from '../decorators/throttle.decorator.js';
import type {
  RateLimitResult,
  RateLimitService,
} from '../rate-limit/rate-limit.service.js';
import { DEFAULT_RATE_LIMIT, RateLimitGuard } from './rate-limit.guard.js';

const ALLOWED: RateLimitResult = {
  allowed: true,
  limit: 600,
  remaining: 599,
  retryAfterSeconds: 0,
};

const THROTTLED: RateLimitResult = {
  allowed: false,
  limit: 5,
  remaining: 0,
  retryAfterSeconds: 30,
};

/**
 * Controlador dummy: el guard solo consulta su handler/clase como destino de
 * los metadatos de `@Throttle`, nunca los invoca durante las pruebas.
 */
class RateLimitProbeController {
  handle(): string {
    return 'probe';
  }
}

const PROBE_HANDLER = RateLimitProbeController.prototype.handle;

function createGuard(options: {
  throttle?: ThrottleOptions;
  result: RateLimitResult;
  ip?: string;
}) {
  if (options.throttle) {
    Reflect.defineMetadata(THROTTLE_KEY, options.throttle, PROBE_HANDLER);
  } else {
    Reflect.deleteMetadata(THROTTLE_KEY, PROBE_HANDLER);
  }

  const getAllAndOverride =
    jest.fn<(...args: unknown[]) => ThrottleOptions | undefined>(
      () => options.throttle,
    );
  const consume = jest.fn<
    (key: string, limit: number, windowMs: number) => RateLimitResult
  >(() => options.result);

  const reflector = { getAllAndOverride } as unknown as Reflector;
  const rateLimit = { consume } as unknown as RateLimitService;

  const setHeader = jest.fn<(name: string, value: string) => void>();
  const request = { method: 'GET', path: '/api/v1/sales', ip: options.ip };
  const response = { setHeader } as unknown as Response;

  const context = {
    getHandler: () => PROBE_HANDLER,
    getClass: () => RateLimitProbeController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return {
    guard: new RateLimitGuard(reflector, rateLimit),
    context,
    consume,
    setHeader,
  };
}

describe('RateLimitGuard', () => {
  it('aplica el límite global por defecto y expone las cabeceras', () => {
    const { guard, context, consume, setHeader } = createGuard({
      result: ALLOWED,
      ip: '10.0.0.1',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(consume).toHaveBeenCalledWith(
      'GET:/api/v1/sales:10.0.0.1',
      DEFAULT_RATE_LIMIT.limit,
      DEFAULT_RATE_LIMIT.windowMs,
    );
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '600');
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '599');
  });

  it('respeta el límite declarado con @Throttle', () => {
    const throttle: ThrottleOptions = { limit: 5, windowMs: 60_000 };
    const { guard, context, consume } = createGuard({
      throttle,
      result: ALLOWED,
      ip: '10.0.0.1',
    });

    guard.canActivate(context);

    expect(consume).toHaveBeenCalledWith(
      'GET:/api/v1/sales:10.0.0.1',
      5,
      60_000,
    );
  });

  it('usa la clave "unknown" cuando la request no trae IP', () => {
    const { guard, context, consume } = createGuard({ result: ALLOWED });

    guard.canActivate(context);

    expect(consume).toHaveBeenCalledWith(
      'GET:/api/v1/sales:unknown',
      DEFAULT_RATE_LIMIT.limit,
      DEFAULT_RATE_LIMIT.windowMs,
    );
  });

  it('lanza 429 con Retry-After cuando se supera el límite', () => {
    const { guard, context, setHeader } = createGuard({
      throttle: { limit: 5, windowMs: 60_000 },
      result: THROTTLED,
      ip: '10.0.0.1',
    });

    let thrown: unknown;

    try {
      guard.canActivate(context);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    const exception = thrown as HttpException;

    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(exception.getResponse()).toMatchObject({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });
});
