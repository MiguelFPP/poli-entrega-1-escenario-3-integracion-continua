export const API_BASE_PATH = '/api/v1';

const REFRESH_PATH = '/auth/refresh';

/** Rutas de sesión: un 401 ahí no se refresca (sería un bucle). */
const NO_REFRESH_PATHS: ReadonlySet<string> = new Set([
  REFRESH_PATH,
  '/auth/login',
]);

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'La solicitud no es válida.',
  401: 'Tu sesión no es válida o ha expirado.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'La operación entra en conflicto con el estado actual.',
  422: 'Los datos enviados no son válidos.',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  500: 'Ocurrió un error interno en el servidor.',
};

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

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  readonly json?: unknown;
  readonly body?: BodyInit | null;
}

/** Mensaje en español según el estado HTTP. */
function messageFor(status: number): string {
  return STATUS_MESSAGES[status] ?? `La API respondió con el estado ${status}.`;
}

function resolveUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_PATH}${normalized}`;
}

/** Path normalizado sin el prefijo de la API, para comparar rutas. */
function normalizePath(path: string): string {
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith(`${API_BASE_PATH}/`)) {
    normalized = normalized.slice(API_BASE_PATH.length);
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function canRefresh(path: string): boolean {
  return !NO_REFRESH_PATHS.has(normalizePath(path));
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function send(path: string, options: ApiFetchOptions): Promise<Response> {
  const { json, headers, body, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(resolveUrl(path), {
      ...rest,
      credentials: 'include',
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  } catch (error) {
    throw new ApiError(
      'No se pudo conectar con la API',
      0,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Refresh en vuelo: varias peticiones 401 en paralelo comparten uno solo. */
let refreshPromise: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_PATH}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    await response.text().catch(() => '');
    return response.ok;
  } catch {
    return false;
  }
}

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<TResponse>(
  path: string,
  options: ApiFetchOptions,
  isRetry: boolean,
): Promise<TResponse> {
  const response = await send(path, options);
  const payload = await readPayload(response);

  if (!response.ok) {
    const error = new ApiError(
      messageFor(response.status),
      response.status,
      payload,
    );
    if (response.status === 401 && !isRetry && canRefresh(path)) {
      if (await refreshSession()) {
        return request<TResponse>(path, options, true);
      }
    }
    throw error;
  }

  return payload as TResponse;
}

/**
 * Cliente HTTP de la web: rutas relativas bajo `/api/v1` y cookies incluidas.
 * Ante un 401 refresca la sesión una sola vez y reintenta la petición.
 */
export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  return request<TResponse>(path, options, false);
}
