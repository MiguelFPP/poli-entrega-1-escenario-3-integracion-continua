import {
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import {
  THROTTLE_KEY,
  type ThrottleOptions,
} from '../decorators/throttle.decorator.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';

/** Límite global alto: protege la API sin estorbar el uso normal. */
export const DEFAULT_RATE_LIMIT: ThrottleOptions = {
  limit: 600,
  windowMs: 60_000,
};

type RateLimitRequest = {
  method: string;
  path: string;
  ip?: string;
};

/** Aplica el límite por IP y ruta; `@Throttle` lo sobrescribe. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options =
      this.reflector.getAllAndOverride<ThrottleOptions>(THROTTLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMIT;

    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitRequest>();
    const response = http.getResponse<Response>();

    const key = `${request.method}:${request.path}:${request.ip ?? 'unknown'}`;
    const result = this.rateLimit.consume(key, options.limit, options.windowMs);

    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (result.allowed) {
      return true;
    }

    response.setHeader('Retry-After', String(result.retryAfterSeconds));

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Demasiadas solicitudes. Intenta de nuevo en ${result.retryAfterSeconds} segundos.`,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
