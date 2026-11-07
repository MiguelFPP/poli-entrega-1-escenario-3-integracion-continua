import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.js';
import { CurrentUser } from './current-user.decorator.js';

/** Clave interna de Nest donde se guarda la fábrica del decorador de parámetro. */
const ROUTE_ARGS_METADATA = '__routeArguments__';

const USER: AuthenticatedUser = {
  id: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  email: 'admin@pos.local',
  role: Role.ADMIN,
};

type UserFactory = (
  data: unknown,
  context: ExecutionContext,
) => AuthenticatedUser;

class ProbeController {
  handle(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

const PROBE_HANDLER = 'handle';

/** Busca la fábrica del decorador dentro de los metadatos de parámetros. */
function findFactory(value: unknown, depth = 0): UserFactory | undefined {
  if (depth > 6 || typeof value !== 'object' || value === null) {
    return undefined;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (typeof entry === 'function') {
      return entry as unknown as UserFactory;
    }

    const nested = findFactory(entry, depth + 1);

    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function readFactory(): UserFactory | undefined {
  const sources: unknown[] = [
    Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProbeController,
      PROBE_HANDLER,
    ) as unknown,
    Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProbeController.prototype,
      PROBE_HANDLER,
    ) as unknown,
  ];

  for (const source of sources) {
    const factory = findFactory(source);

    if (factory) {
      return factory;
    }
  }

  return undefined;
}

function createContext(user: AuthenticatedUser | undefined): ExecutionContext {
  const request = { user } as unknown as { user?: AuthenticatedUser };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const factory = readFactory();

describe('CurrentUser', () => {
  it('extrae el usuario autenticado de la request', () => {
    expect(factory).toBeDefined();
    expect(factory?.(undefined, createContext(USER))).toEqual(USER);
  });

  it('lanza UnauthorizedException cuando la request no tiene usuario', () => {
    expect(factory).toBeDefined();
    expect(() => factory?.(undefined, createContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});
