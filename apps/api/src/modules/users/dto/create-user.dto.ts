import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Matches,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_MESSAGE,
} from '../../../common/security/password.js';

/** Alta de usuario administrador (el rol queda fijo en `ADMIN` en el MVP). */
export class CreateUserDto {
  @ApiProperty({
    description: 'Nombre visible del usuario.',
    example: 'Cajera Turno Mañana',
    minLength: 2,
    maxLength: 120,
  })
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'name no puede superar 120 caracteres' })
  name!: string;

  @ApiProperty({
    description:
      'Email único. Se normaliza (trim + minúsculas); un duplicado responde `409`.',
    format: 'email',
    example: 'cajera@pos.local',
    maxLength: 254,
  })
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254, { message: 'El email no puede superar 254 caracteres' })
  email!: string;

  @ApiProperty({
    description: PASSWORD_POLICY_MESSAGE,
    format: 'password',
    example: 'Cajera2026!',
    minLength: 8,
    maxLength: 72,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}
