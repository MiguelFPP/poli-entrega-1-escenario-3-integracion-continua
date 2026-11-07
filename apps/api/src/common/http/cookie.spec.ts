import { describe, expect, it } from '@jest/globals';
import type { Request } from 'express';
import { readCookie } from './cookie.js';

function createRequest(cookies: unknown): Request {
  return { cookies } as unknown as Request;
}

describe('readCookie', () => {
  it('devuelve el valor cuando la cookie existe', () => {
    const request = createRequest({ access_token: 'valor' });

    expect(readCookie(request, 'access_token')).toBe('valor');
  });

  it('devuelve undefined cuando la cookie solicitada no está presente', () => {
    const request = createRequest({ refresh_token: 'otro' });

    expect(readCookie(request, 'access_token')).toBeUndefined();
  });

  it('devuelve undefined para un valor vacío', () => {
    const request = createRequest({ access_token: '' });

    expect(readCookie(request, 'access_token')).toBeUndefined();
  });

  it('devuelve undefined para un valor que no es texto', () => {
    const request = createRequest({ access_token: 123 });

    expect(readCookie(request, 'access_token')).toBeUndefined();
  });

  it('devuelve undefined cuando la request no tiene cookies', () => {
    expect(readCookie(createRequest(undefined), 'access_token')).toBeUndefined();
  });

  it('devuelve undefined cuando las cookies son null', () => {
    expect(readCookie(createRequest(null), 'access_token')).toBeUndefined();
  });

  it('devuelve undefined cuando las cookies no son un objeto', () => {
    expect(readCookie(createRequest('no-objeto'), 'access_token')).toBeUndefined();
  });
});
