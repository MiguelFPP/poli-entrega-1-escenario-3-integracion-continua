import bcrypt from 'bcryptjs';

/** Coste de bcrypt para contraseñas creadas por la API (igual que el seed). */
export const PASSWORD_HASH_ROUNDS = 12;

/** Política: mínimo 8, una mayúscula, una minúscula y un número. */
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';

/**
 * Hash válido usado como señuelo: comparar contra él mantiene el tiempo de
 * respuesta similar cuando el email no existe (evita enumeración de usuarios).
 */
export const TIMING_DUMMY_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZT5S1o1oQ3Ck8s7cQz9Zk1uW6vXyZa';

/** Normaliza el email: sin espacios y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_HASH_ROUNDS);
}

/** Compara contraseña y hash; un hash corrupto se trata como no coincidente. */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
