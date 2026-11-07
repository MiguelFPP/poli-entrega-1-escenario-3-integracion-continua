import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { Role, type PrismaClient } from '../../src/generated/prisma/client.js';
import type { UserModel } from '../../src/generated/prisma/models.js';
import { factoryError } from './errors.js';

/** Coste de bcrypt de las factories: bajo para no frenar los tests. */
export const FACTORY_BCRYPT_ROUNDS = 4;

/** Contraseña por defecto de los usuarios de prueba. */
export const DEFAULT_FACTORY_PASSWORD = 'Password123!';

/** Hash bcrypt válido usado por el builder puro (no requiere await). */
const PLACEHOLDER_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZT5S1o1oQ3Ck8s7cQz9Zk1uW6vXyZa';

export type UserBuildInput = {
  name?: string;
  email?: string;
  passwordHash?: string;
  role?: Role;
  active?: boolean;
};

export type UserBuildData = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
};

/** Construye los datos de un usuario sin tocar la base de datos. */
export function buildUser(overrides: UserBuildInput = {}): UserBuildData {
  const email =
    overrides.email ??
    `${faker.internet
      .username()
      .toLowerCase()
      .replace(
        /[^a-z0-9._-]/g,
        '',
      )}.${faker.string.alphanumeric({ length: 6, casing: 'lower' })}@pos.local`;

  return {
    name: overrides.name ?? faker.person.fullName(),
    email,
    passwordHash: overrides.passwordHash ?? PLACEHOLDER_HASH,
    role: overrides.role ?? Role.ADMIN,
    active: overrides.active ?? true,
  };
}

export type CreateUserOptions = UserBuildInput & {
  /** Contraseña en claro; se hashea con bcrypt. */
  password?: string;
  /** Coste de bcrypt (por defecto 4). */
  rounds?: number;
};

export async function createUser(
  client: PrismaClient,
  options: CreateUserOptions = {},
): Promise<UserModel> {
  const {
    password = DEFAULT_FACTORY_PASSWORD,
    rounds = FACTORY_BCRYPT_ROUNDS,
    ...overrides
  } = options;

  try {
    const passwordHash =
      overrides.passwordHash ?? (await bcrypt.hash(password, rounds));
    return await client.user.create({
      data: buildUser({ ...overrides, passwordHash }),
    });
  } catch (error) {
    throw factoryError('createUser', error);
  }
}
