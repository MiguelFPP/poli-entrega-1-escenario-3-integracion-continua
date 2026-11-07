import type { UserModel } from '../../generated/prisma/models.js';
import type { AuthUserDto } from './dto/auth-user.dto.js';

export type AuthUserSource = Pick<
  UserModel,
  'id' | 'name' | 'email' | 'role' | 'active' | 'createdAt'
>;

/** Proyección pública del usuario: descarta `passwordHash` por construcción. */
export function toAuthUserDto(user: AuthUserSource): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}
