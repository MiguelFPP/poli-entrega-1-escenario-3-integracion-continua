import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';

const DATABASE_URL = 'postgresql://pos:pos@localhost:5432/pos_test';

function createService() {
  const getOrThrow = jest.fn<(key: string) => string>(() => DATABASE_URL);
  const config = { getOrThrow } as unknown as ConfigService;

  const service = new PrismaService(config);

  const queryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const connect = jest.fn<() => Promise<void>>();
  const disconnect = jest.fn<() => Promise<void>>();

  // Se reemplazan los métodos reales para no abrir conexión contra PostgreSQL.
  Object.defineProperty(service, '$queryRaw', {
    value: queryRaw,
    configurable: true,
  });
  Object.defineProperty(service, '$connect', {
    value: connect,
    configurable: true,
  });
  Object.defineProperty(service, '$disconnect', {
    value: disconnect,
    configurable: true,
  });

  return { service, getOrThrow, queryRaw, connect, disconnect };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PrismaService', () => {
  it('lee DATABASE_URL de la configuración al construirse', () => {
    const { getOrThrow } = createService();

    expect(getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
  });

  it('abre la conexión en onModuleInit', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service, connect } = createService();
    connect.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('cierra la conexión en onModuleDestroy', async () => {
    const { service, disconnect } = createService();
    disconnect.mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  describe('isHealthy', () => {
    it('devuelve true cuando la consulta de prueba responde', async () => {
      const { service, queryRaw } = createService();
      queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(service.isHealthy()).resolves.toBe(true);
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('devuelve false y registra el error cuando la consulta falla', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { service, queryRaw } = createService();
      queryRaw.mockRejectedValue(new Error('sin conexión'));

      await expect(service.isHealthy()).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
