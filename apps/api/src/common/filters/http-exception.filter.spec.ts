import { describe, expect, it, jest } from '@jest/globals';
import {
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter.js';

type Captured = {
  status?: number;
  body?: Record<string, unknown>;
  headers: Record<string, string>;
};

type TestHost = {
  host: ArgumentsHost;
  captured: Captured;
};

function createHost(): TestHost {
  const captured: Captured = { headers: {} };

  const json = jest.fn((body: Record<string, unknown>) => {
    captured.body = body;
  });
  const status = jest.fn((code: number) => {
    captured.status = code;
    return { json };
  });
  const setHeader = jest.fn((name: string, value: string) => {
    captured.headers[name] = value;
  });

  const response = { setHeader, status, json } as unknown as Response;
  const request = {
    method: 'POST',
    url: '/api/v1/products',
  } as unknown as Request;

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe('HttpExceptionFilter', () => {
  it('normaliza una HttpException con respuesta string', () => {
    const { host, captured } = createHost();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    new HttpExceptionFilter().catch(
      new HttpException('No autorizado', HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(captured.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'No autorizado',
      error: 'Unauthorized',
      path: '/api/v1/products',
    });
    expect(typeof captured.body?.timestamp).toBe('string');
  });

  it('conserva el arreglo de mensajes de validación', () => {
    const { host, captured } = createHost();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    new HttpExceptionFilter().catch(
      new HttpException(
        ['name debe ser texto', 'salePrice debe ser positivo'],
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['name debe ser texto', 'salePrice debe ser positivo'],
      error: 'Bad Request',
    });
  });

  it('replica las cabeceras de un 429 (Retry-After)', () => {
    const { host, captured } = createHost();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    new HttpExceptionFilter().catch(
      new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Demasiadas solicitudes',
          error: 'Too Many Requests',
          headers: { 'Retry-After': '30', 'X-RateLimit-Limit': 5 },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      host,
    );

    expect(captured.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(captured.headers).toEqual({
      'Retry-After': '30',
      'X-RateLimit-Limit': '5',
    });
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Demasiadas solicitudes',
      error: 'Too Many Requests',
    });
  });

  it('oculta los errores no HTTP como 500 y no filtra el stack', () => {
    const { host, captured } = createHost();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    new HttpExceptionFilter().catch(new Error('boom interno'), host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
      error: 'Internal Server Error',
      timestamp: expect.any(String),
      path: '/api/v1/products',
    });
    expect(captured.body).not.toHaveProperty('stack');
  });
});
