import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Credenciales de inicio de sesión. */
export class LoginDto {
  @ApiProperty({
    description:
      'Email del usuario. Se normaliza (trim + minúsculas) antes de consultar.',
    format: 'email',
    example: 'admin@pos.local',
    maxLength: 254,
  })
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254, { message: 'El email no puede superar 254 caracteres' })
  email!: string;

  @ApiProperty({
    description:
      'Contraseña en claro. bcrypt solo considera los primeros 72 bytes.',
    example: 'Admin123!',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  password!: string;
}
