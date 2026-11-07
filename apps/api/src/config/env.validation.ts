import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
  type ValidationError,
} from 'class-validator';

/** Variables de entorno requeridas y opcionales de la API. */
export class EnvironmentVariables {
  @IsString({ message: 'DATABASE_URL debe ser texto' })
  @IsNotEmpty({ message: 'DATABASE_URL es obligatoria' })
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt({ message: 'PORT debe ser un número entero' })
  @Min(1, { message: 'PORT debe estar entre 1 y 65535' })
  @Max(65535, { message: 'PORT debe estar entre 1 y 65535' })
  PORT: number = 3001;

  // Se validan ahora y se consumirán en la fase de autenticación.
  @IsOptional()
  @IsString({ message: 'JWT_ACCESS_SECRET debe ser texto' })
  JWT_ACCESS_SECRET?: string;

  @IsOptional()
  @IsString({ message: 'JWT_REFRESH_SECRET debe ser texto' })
  JWT_REFRESH_SECRET?: string;
}

export type Env = EnvironmentVariables;

function formatErrors(errors: ValidationError[]): string {
  return errors
    .map((error) => {
      const constraints = Object.values(error.constraints ?? {});
      return `${error.property}: ${constraints.join(', ') || 'valor inválido'}`;
    })
    .join(' | ');
}

/** Valida `process.env` y detiene el arranque si la configuración es inválida. */
export function validateEnv(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Configuración de entorno inválida -> ${formatErrors(errors)}`,
    );
  }

  return { ...raw, ...parsed };
}
