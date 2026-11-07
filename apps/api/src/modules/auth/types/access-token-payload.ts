import type { Role } from '../../../generated/prisma/client.js';

/** Contenido firmado del access token. */
export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
};

/** Datos que se firman (los `iat`/`exp` los agrega el servicio). */
export type AccessTokenClaims = Pick<
  AccessTokenPayload,
  'sub' | 'email' | 'role'
>;
