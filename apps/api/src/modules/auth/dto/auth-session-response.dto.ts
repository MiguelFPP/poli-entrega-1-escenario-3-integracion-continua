import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from './auth-user.dto.js';

/**
 * Respuesta de login y refresh. Los tokens viajan **solo** en cookies
 * `httpOnly`; el body nunca los incluye.
 */
export class AuthSessionResponseDto {
  @ApiProperty({
    description: 'Usuario autenticado, sin `passwordHash`.',
    type: AuthUserDto,
  })
  user!: AuthUserDto;

  @ApiProperty({
    description:
      'Segundos de vida del access token. El JWT caduca a los 15 minutos aunque la cookie dure 7 días.',
    example: 900,
  })
  accessTokenExpiresIn!: number;

  @ApiProperty({
    description: 'Segundos de vida del refresh token (7 días).',
    example: 604800,
  })
  refreshTokenExpiresIn!: number;
}
