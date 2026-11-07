import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client.js';

/** Usuario tal como lo expone la API (nunca incluye `passwordHash`). */
export class AuthUserDto {
  @ApiProperty({
    description: 'Identificador único (UUID v4).',
    format: 'uuid',
    example: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre visible del usuario.',
    example: 'Administrador POS',
  })
  name!: string;

  @ApiProperty({
    description: 'Email normalizado a minúsculas.',
    format: 'email',
    example: 'admin@pos.local',
  })
  email!: string;

  @ApiProperty({
    description: 'Rol del usuario dentro del sistema.',
    enum: Role,
    enumName: 'Role',
    example: Role.ADMIN,
  })
  role!: Role;

  @ApiProperty({
    description: 'Indica si la cuenta puede iniciar sesión.',
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description: 'Fecha de creación (ISO 8601, UTC).',
    example: '2026-01-15T12:00:00.000Z',
  })
  createdAt!: string;
}
