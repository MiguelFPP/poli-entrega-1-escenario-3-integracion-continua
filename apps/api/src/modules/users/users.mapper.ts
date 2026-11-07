import type {
  UserGetPayload,
  UserSelect,
} from '../../generated/prisma/models.js';
import type { UserResponseDto } from './dto/user-response.dto.js';

/** Selección pública: nunca trae `passwordHash` desde la base. */
export const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies UserSelect;

export type UserPublic = UserGetPayload<{ select: typeof USER_PUBLIC_SELECT }>;

export function toUserResponseDto(user: UserPublic): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
