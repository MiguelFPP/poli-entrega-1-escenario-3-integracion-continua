import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'rate-limit:options';

export type ThrottleOptions = {
  /** Solicitudes permitidas por ventana. */
  limit: number;
  /** Tamaño de la ventana en milisegundos. */
  windowMs: number;
};

/** Sobrescribe el límite global de peticiones para un handler. */
export const Throttle = (
  options: ThrottleOptions,
): MethodDecorator & ClassDecorator => SetMetadata(THROTTLE_KEY, options);
