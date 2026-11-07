import { ApiProperty } from '@nestjs/swagger';
import { PriceField } from '../../../generated/prisma/client.js';

/** Usuario que registró un cambio de precio. */
export class PriceHistoryChangedByDto {
  @ApiProperty({
    description: 'Identificador único del usuario.',
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
    description: 'Email del usuario.',
    format: 'email',
    example: 'admin@pos.local',
  })
  email!: string;
}

/** Registro del historial de cambios de precio. */
export class PriceHistoryResponseDto {
  @ApiProperty({
    description: 'Identificador único del registro.',
    format: 'uuid',
    example: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
  })
  id!: string;

  @ApiProperty({
    description: 'Producto al que pertenece el cambio.',
    format: 'uuid',
    example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  })
  productId!: string;

  @ApiProperty({
    description: 'Campo de precio modificado: `COST` (costo) o `SALE` (venta).',
    enum: PriceField,
    enumName: 'PriceField',
    example: PriceField.SALE,
  })
  field!: PriceField;

  @ApiProperty({
    description: 'Valor anterior en COP (`0` al crear el producto).',
    example: 1800,
    minimum: 0,
  })
  oldValue!: number;

  @ApiProperty({
    description: 'Valor nuevo en COP.',
    example: 2000,
    minimum: 0,
  })
  newValue!: number;

  @ApiProperty({
    description:
      'Usuario que realizó el cambio o `null` si lo hizo un proceso automático.',
    type: PriceHistoryChangedByDto,
    nullable: true,
  })
  changedBy!: PriceHistoryChangedByDto | null;

  @ApiProperty({
    description: 'Fecha del cambio (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  createdAt!: string;
}
