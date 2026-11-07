import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description:
      'Resultado global del chequeo. `ok` solo si todas las dependencias están disponibles.',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status!: 'ok' | 'error';

  @ApiProperty({
    description: 'Estado de la conexión con PostgreSQL.',
    enum: ['up', 'down'],
    example: 'up',
  })
  database!: 'up' | 'down';

  @ApiProperty({
    description: 'Momento en que se ejecutó el chequeo (ISO 8601, UTC).',
    example: '2026-01-15T12:34:56.789Z',
  })
  timestamp!: string;
}
