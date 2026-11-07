import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { readCookie } from '../http/cookie.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.js';
import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/auth.constants.js';
import { TokenService } from '../../modules/auth/token.service.js';

const BEARER_PREFIX = 'Bearer ';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Cookie `access_token` primero; si no hay, `Authorization: Bearer`. */
export function extractAccessToken(request: Request): string | undefined {
  const cookieToken = readCookie(request, ACCESS_TOKEN_COOKIE);

  if (cookieToken) {
    return cookieToken;
  }

  const header = request.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  return token.length > 0 ? token : undefined;
}

/** Guard global: todo es privado salvo lo marcado con `@Public()`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Se requiere autenticación');
    }

    const payload = this.tokens.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }
}
