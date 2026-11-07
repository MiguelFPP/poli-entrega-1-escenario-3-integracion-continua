import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
  type ValidationError,
} from 'class-validator';
import { DEFAULT_WEB_ORIGIN } from './web-origin.js';

const MIN_SECRET_LENGTH = 32;

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

  @IsString({ message: 'JWT_ACCESS_SECRET debe ser texto' })
  @MinLength(MIN_SECRET_LENGTH, {
    message: `JWT_ACCESS_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
  })
  JWT_ACCESS_SECRET!: string;

  @IsString({ message: 'JWT_REFRESH_SECRET debe ser texto' })
  @MinLength(MIN_SECRET_LENGTH, {
    message: `JWT_REFRESH_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
  })
  JWT_REFRESH_SECRET!: string;

  /** Origen del frontend; admite varios separados por comas. */
  @Transform(({ value }): unknown =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  @IsOptional()
  @IsString({ message: 'WEB_ORIGIN debe ser texto' })
  @Matches(/^https?:\/\/[^\s,]+(?:\s*,\s*https?:\/\/[^\s,]+)*$/, {
    message:
      'WEB_ORIGIN debe ser una lista de URLs http(s) separadas por comas',
  })
  WEB_ORIGIN: string = DEFAULT_WEB_ORIGIN;
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
