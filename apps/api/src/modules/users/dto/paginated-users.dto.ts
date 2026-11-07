import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto.js';
import { UserResponseDto } from './user-response.dto.js';

/** Listado paginado de usuarios. */
export class PaginatedUsersDto {
  @ApiProperty({
    description: 'Usuarios de la página solicitada.',
    type: () => [UserResponseDto],
  })
  data!: UserResponseDto[];

  @ApiProperty({
    description: 'Metadatos de paginación.',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
