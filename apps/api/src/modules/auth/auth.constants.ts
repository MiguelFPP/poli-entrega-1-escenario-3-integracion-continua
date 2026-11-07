/** Nombres y tiempos de vida de las cookies y tokens de sesión. */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** La cookie del refresh solo viaja a los endpoints de auth. */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

const DAY_MS = 24 * 60 * 60 * 1000;

/** El JWT expira a los 15 minutos. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** La cookie del access dura 7 días aunque el JWT caduque antes. */
export const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 7 * DAY_MS;

/** El refresh token (y su cookie) dura 7 días. */
export const REFRESH_TOKEN_TTL_MS = 7 * DAY_MS;
export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_MS;

/** 64 bytes aleatorios -> 86 caracteres en base64url. */
export const REFRESH_TOKEN_BYTES = 64;
