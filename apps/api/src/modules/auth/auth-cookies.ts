import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants.js';
import type { IssuedTokens } from './types/issued-tokens.js';

type CookieSettings = {
  secure: boolean;
  path: string;
  maxAge?: number;
};

function cookieOptions({
  secure,
  path,
  maxAge,
}: CookieSettings): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path,
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

/** Deja `access_token` y `refresh_token` en cookies httpOnly. */
export function setAuthCookies(
  response: Response,
  tokens: IssuedTokens,
  secure: boolean,
): void {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    cookieOptions({
      secure,
      path: '/',
      maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
    }),
  );

  response.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    cookieOptions({
      secure,
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    }),
  );
}

/** Expira ambas cookies de sesión. */
export function clearAuthCookies(response: Response, secure: boolean): void {
  response.clearCookie(
    ACCESS_TOKEN_COOKIE,
    cookieOptions({ secure, path: '/' }),
  );

  response.clearCookie(
    REFRESH_TOKEN_COOKIE,
    cookieOptions({ secure, path: REFRESH_TOKEN_COOKIE_PATH }),
  );
}
