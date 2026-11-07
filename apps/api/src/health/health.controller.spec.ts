import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function createController(databaseUp: boolean) {
  const isHealthy = jest.fn(async () => databaseUp);
  const prisma = { isHealthy } as unknown as PrismaService;
  const status = jest.fn();
  const response = { status } as unknown as Response;

  return {
    controller: new HealthController(prisma),
    isHealthy,
    status,
    response,
  };
}

describe('HealthController', () => {
  it('responde ok cuando PostgreSQL está disponible', async () => {
    const { controller, isHealthy, status, response } = createController(true);

    const result = await controller.check(response);

    expect(isHealthy).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(result.database).toBe('up');
    expect(result.status).toBe('ok');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('responde 503 y database down cuando PostgreSQL falla', async () => {
    const { controller, status, response } = createController(false);

    const result = await controller.check(response);

    expect(status).toHaveBeenCalledWith(503);
    expect(result).toMatchObject({ status: 'error', database: 'down' });
  });
});
