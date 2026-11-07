import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Actualización parcial de un usuario; al menos un campo es obligatorio. */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre visible.',
    example: 'Cajera Turno Tarde',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'name no puede superar 120 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description:
      'Nuevo email único. Se normaliza a minúsculas; un duplicado responde `409`.',
    format: 'email',
    example: 'cajera.tarde@pos.local',
    maxLength: 254,
  })
  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254, { message: 'El email no puede superar 254 caracteres' })
  email?: string;

  @ApiPropertyOptional({
    description:
      'Activa o desactiva la cuenta. Un usuario inactivo no puede iniciar sesión.',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
