import { ApiProperty } from '@nestjs/swagger';

/** Categoría expuesta por la API, con el número de productos no eliminados. */
export class CategoryResponseDto {
  @ApiProperty({
    description: 'Identificador único (UUID v4).',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre único de la categoría.',
    example: 'Bebidas',
  })
  name!: string;

  @ApiProperty({
    description: 'Descripción de la categoría o `null`.',
    example: 'Bebidas frías y calientes',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description:
      'Si es `false` la categoría está desactivada (borrado lógico) y no admite productos nuevos.',
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description:
      'Cantidad de productos no eliminados lógicamente asociados a la categoría.',
    example: 12,
    minimum: 0,
  })
  productCount!: number;

  @ApiProperty({
    description: 'Fecha de creación (ISO 8601, UTC).',
    example: '2026-02-10T14:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Fecha de la última actualización (ISO 8601, UTC).',
    example: '2026-02-12T09:15:00.000Z',
  })
  updatedAt!: string;
}
