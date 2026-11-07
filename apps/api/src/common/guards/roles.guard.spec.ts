import { describe, expect, it, jest } from '@jest/globals';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

const USER: AuthenticatedUser = {
  id: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  email: 'admin@pos.local',
  role: Role.ADMIN,
};

function createGuard(roles: Role[] | undefined, user: AuthenticatedUser | undefined) {
  const getAllAndOverride = jest.fn<(...args: unknown[]) => Role[] | undefined>(
    () => roles,
  );
  const reflector = { getAllAndOverride } as unknown as Reflector;

  const request = { user } as unknown as AuthenticatedRequest;
  const context = {
    getHandler: () => () => undefined,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { guard: new RolesGuard(reflector), context, getAllAndOverride };
}

describe('RolesGuard', () => {
  it('deja pasar los handlers sin @Roles', () => {
    const { guard, context } = createGuard(undefined, USER);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('consulta los roles con la clave de metadatos de @Roles', () => {
    const { guard, context, getAllAndOverride } = createGuard([Role.ADMIN], USER);

    guard.canActivate(context);

    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('rechaza con 401 cuando el handler exige rol pero no hay usuario', () => {
    const { guard, context } = createGuard([Role.ADMIN], undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rechaza con 403 cuando el rol del usuario no está entre los requeridos', () => {
    const { guard, context } = createGuard([Role.CASHIER], USER);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permite el acceso cuando el rol del usuario está entre los requeridos', () => {
    const { guard, context } = createGuard([Role.ADMIN, Role.CASHIER], USER);

    expect(guard.canActivate(context)).toBe(true);
  });
});
