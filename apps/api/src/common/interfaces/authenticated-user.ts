import type { Role } from '../../generated/prisma/client.js';

/** Datos mínimos del usuario autenticado (contenido del access token). */
export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
};
