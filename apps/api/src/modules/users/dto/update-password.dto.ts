import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_MESSAGE,
} from '../../../common/security/password.js';

/** Cambio de contraseña de un usuario existente. */
export class UpdatePasswordDto {
  @ApiProperty({
    description: PASSWORD_POLICY_MESSAGE,
    format: 'password',
    example: 'Nueva2026!',
    minLength: 8,
    maxLength: 72,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}
