import { describe, expect, it, jest } from '@jest/globals';
import {
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { OriginGuard } from './origin.guard.js';

function createGuard(webOrigin: string | undefined) {
  const get = jest.fn<(key: string) => string | undefined>(() => webOrigin);
  const config = { get } as unknown as ConfigService;

  return { guard: new OriginGuard(config), get };
}

function createContext(method: string, origin?: string): ExecutionContext {
  const headers: Record<string, string> = {};

  if (origin !== undefined) {
    headers.origin = origin;
  }

  const request = { method, headers } as unknown as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  it('deja pasar los métodos de solo lectura aunque el Origin sea ajeno', () => {
    const { guard } = createGuard('http://app.local');

    expect(guard.canActivate(createContext('GET', 'http://evil.local'))).toBe(
      true,
    );
  });

  it('deja pasar las mutaciones sin cabecera Origin', () => {
    const { guard } = createGuard('http://app.local');

    expect(guard.canActivate(createContext('POST'))).toBe(true);
  });

  it('deja pasar una mutación con el Origin permitido', () => {
    const { guard, get } = createGuard('http://app.local');

    expect(guard.canActivate(createContext('PATCH', 'http://app.local'))).toBe(
      true,
    );
    expect(get).toHaveBeenCalledWith('WEB_ORIGIN');
  });

  it('normaliza el método a mayúsculas antes de decidir', () => {
    const { guard } = createGuard('http://app.local');

    expect(guard.canActivate(createContext('post', 'http://app.local'))).toBe(
      true,
    );
  });

  it('rechaza con 403 una mutación desde un Origin no permitido', () => {
    const { guard } = createGuard('http://app.local');

    expect(() =>
      guard.canActivate(createContext('DELETE', 'http://evil.local')),
    ).toThrow(ForbiddenException);
  });

  it('deja pasar un Origin vacío (petición sin navegador)', () => {
    const { guard } = createGuard('http://app.local');

    expect(guard.canActivate(createContext('POST', ''))).toBe(true);
  });

  it('admite un Origin incluido en una lista separada por comas', () => {
    const { guard } = createGuard('http://app.local, http://panel.local');

    expect(
      guard.canActivate(createContext('POST', 'http://panel.local')),
    ).toBe(true);
  });

  it('cae al origen por defecto cuando WEB_ORIGIN está vacío', () => {
    const { guard } = createGuard(undefined);

    expect(guard.canActivate(createContext('POST', 'http://localhost:3000'))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(createContext('POST', 'http://evil.local')),
    ).toThrow(ForbiddenException);
  });
});
