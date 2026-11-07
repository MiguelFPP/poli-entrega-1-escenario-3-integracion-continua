import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { webOrigins } from '../../config/web-origin.js';

/** Métodos que modifican estado: solo estos exigen `Origin` válido. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Guard global anti-CSRF para mutaciones: si el navegador envía `Origin`, debe
 * coincidir con `WEB_ORIGIN`. Sin `Origin` (curl, tests, server-to-server) pasa.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = request.headers.origin;

    if (typeof origin !== 'string' || origin.length === 0) {
      return true;
    }

    if (!webOrigins(this.config).includes(origin)) {
      throw new ForbiddenException('Origen no permitido');
    }

    return true;
  }
}
