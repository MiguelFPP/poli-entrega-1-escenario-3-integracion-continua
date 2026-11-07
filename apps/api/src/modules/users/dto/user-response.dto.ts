import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client.js';

/** Usuario de administración expuesto por la API (sin `passwordHash`). */
export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador único (UUID v4).',
    format: 'uuid',
    example: '9b2f0b7a-1b6c-4c8d-9e2a-3f4b5c6d7e8f',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre visible del usuario.',
    example: 'Cajera Turno Mañana',
  })
  name!: string;

  @ApiProperty({
    description: 'Email único, normalizado a minúsculas.',
    format: 'email',
    example: 'cajera@pos.local',
  })
  email!: string;

  @ApiProperty({
    description: 'Rol del usuario.',
    enum: Role,
    enumName: 'Role',
    example: Role.ADMIN,
  })
  role!: Role;

  @ApiProperty({
    description: 'Si es `false` el usuario no puede iniciar sesión.',
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description: 'Fecha de creación (ISO 8601, UTC).',
    example: '2026-01-15T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Fecha de la última actualización (ISO 8601, UTC).',
    example: '2026-01-20T08:30:00.000Z',
  })
  updatedAt!: string;
}
