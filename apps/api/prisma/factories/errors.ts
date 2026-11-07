/** Envuelve un error de base de datos con el contexto de la factory. */
export function factoryError(factory: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`[factories] ${factory} falló: ${detail}`, { cause });
}
