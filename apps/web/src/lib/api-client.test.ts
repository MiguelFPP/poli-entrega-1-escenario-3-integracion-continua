import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ApiClient = typeof import('./api-client');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function loadClient(): Promise<ApiClient> {
  vi.resetModules();
  return import('./api-client');
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('devuelve el cuerpo JSON de una respuesta correcta', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [1, 2] }));
    const { apiFetch } = await loadClient();

    await expect(apiFetch('/ventas')).resolves.toEqual({ data: [1, 2] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/ventas');
    expect(init.credentials).toBe('include');
    expect(init.headers.get('Accept')).toBe('application/json');
    expect(init.headers.get('Content-Type')).toBeNull();
  });

  it('refresca la sesión y reintenta una sola vez tras un 401', async () => {
    const calls: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      calls.push(url);
      if (url === '/api/v1/auth/refresh') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      return Promise.resolve(
        calls.filter((item) => item === url).length === 1
          ? jsonResponse({ message: 'Se requiere autenticación' }, 401)
          : jsonResponse({ id: 'venta-1' }),
      );
    });
    const { apiFetch } = await loadClient();

    await expect(apiFetch('/ventas')).resolves.toEqual({ id: 'venta-1' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls).toEqual([
      '/api/v1/ventas',
      '/api/v1/auth/refresh',
      '/api/v1/ventas',
    ]);
  });

  it('reenvía el cuerpo original al reintentar tras el refresco', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/v1/auth/refresh'
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: 'No autorizado' }, 401),
      ),
    );
    const { apiFetch } = await loadClient();

    await expect(
      apiFetch('/ventas', { method: 'POST', json: { total: 100 } }),
    ).rejects.toMatchObject({ status: 401 });

    const retryCall = fetchMock.mock.calls[2];
    expect(retryCall[1].body).toBe(JSON.stringify({ total: 100 }));
    expect(retryCall[1].headers.get('Content-Type')).toBe('application/json');
    // El reintento que vuelve a fallar con 401 no dispara otro refresco.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lanza ApiError 401 si el refresco también falla', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/v1/auth/refresh'
          ? jsonResponse({ message: 'Refresh token inválido' }, 401)
          : jsonResponse({ message: 'Se requiere autenticación' }, 401),
      ),
    );
    const { apiFetch, ApiError } = await loadClient();

    const error = await apiFetch('/ventas').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).status).toBe(401);
    // Se propaga el 401 original, no el del refresco fallido.
    expect((error as InstanceType<typeof ApiError>).payload).toEqual({
      message: 'Se requiere autenticación',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lanza ApiError con el cuerpo de error en un 500', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 500, error: 'Internal Server Error', message: 'Roto' },
        500,
      ),
    );
    const { apiFetch, ApiError } = await loadClient();

    const error = await apiFetch('/ventas').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).status).toBe(500);
    expect((error as InstanceType<typeof ApiError>).payload).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Roto',
    });
  });

  it('no refresca cuando falla el login', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Credenciales inválidas' }, 401),
    );
    const { apiFetch } = await loadClient();

    await expect(
      apiFetch('/auth/login', {
        method: 'POST',
        json: { email: 'a@b.co', password: 'x' },
      }),
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no refresca cuando falla el propio refresco', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Refresh token expirado' }, 401),
    );
    const { apiFetch } = await loadClient();

    await expect(
      apiFetch('/auth/refresh', { method: 'POST' }),
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('comparte un único refresco entre peticiones paralelas con 401', async () => {
    const calls: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      calls.push(url);
      if (url === '/api/v1/auth/refresh') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      const attempts = calls.filter((item) => item === url).length;
      return Promise.resolve(
        attempts === 1
          ? jsonResponse({ message: 'Se requiere autenticación' }, 401)
          : jsonResponse({ ok: true }),
      );
    });
    const { apiFetch } = await loadClient();

    const results = await Promise.all([
      apiFetch('/ventas'),
      apiFetch('/productos'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const refreshCalls = calls.filter((url) => url === '/api/v1/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('devuelve null cuando la respuesta no tiene cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { apiFetch } = await loadClient();

    await expect(
      apiFetch('/auth/logout', { method: 'POST' }),
    ).resolves.toBeNull();
  });

  it('devuelve el texto plano cuando la respuesta no es JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('texto plano', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const { apiFetch } = await loadClient();

    await expect(apiFetch('/salud')).resolves.toBe('texto plano');
  });

  it('convierte un fallo de red en ApiError con estado 0', async () => {
    fetchMock.mockRejectedValue(new Error('sin conexión'));
    const { apiFetch, ApiError } = await loadClient();

    const error = await apiFetch('/ventas').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).status).toBe(0);
    expect((error as InstanceType<typeof ApiError>).message).toBe(
      'No se pudo conectar con la API',
    );
  });
});
