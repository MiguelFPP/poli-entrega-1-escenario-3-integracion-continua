const API_BASE_PATH = '/api/v1';

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  readonly json?: unknown;
  readonly body?: BodyInit | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function resolveUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_PATH}${normalized}`;
}

/**
 * Cliente HTTP mínimo de la fase 0: rutas relativas bajo `/api/v1`
 * (el rewrite de Next reenvía a la API) y cookies incluidas.
 */
export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  const { json, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      credentials: 'include',
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  } catch (error) {
    throw new ApiError(
      'No se pudo conectar con la API',
      0,
      error instanceof Error ? error.message : error,
    );
  }

  const text = await response.text();
  const payload = text.length > 0 ? parseJson(text) : null;

  if (!response.ok) {
    throw new ApiError(
      `La API respondió ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as TResponse;
}
