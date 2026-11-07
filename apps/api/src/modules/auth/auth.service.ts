import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  TIMING_DUMMY_HASH,
  normalizeEmail,
  verifyPassword,
} from '../../common/security/password.js';
import { toAuthUserDto } from './auth.mapper.js';
import type { AuthUserDto } from './dto/auth-user.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SessionContext } from './session-context.js';
import { TokenService } from './token.service.js';
import type { IssuedTokens } from './types/issued-tokens.js';

export type AuthSession = {
  user: AuthUserDto;
  tokens: IssuedTokens;
};

const INVALID_CREDENTIALS = 'Credenciales inválidas';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Valida credenciales activas y abre una sesión nueva. */
  async login(dto: LoginDto, context: SessionContext): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });

    if (!user) {
      // Comparación señuelo: el tiempo de respuesta no delata emails inexistentes.
      await verifyPassword(dto.password, TIMING_DUMMY_HASH);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.active) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const tokens = await this.tokens.issueSession(user, context);

    return { user: toAuthUserDto(user), tokens };
  }

  /** Rota el refresh token y devuelve la sesión renovada. */
  async refresh(
    rawToken: string,
    context: SessionContext,
  ): Promise<AuthSession> {
    const { tokens, user } = await this.tokens.rotate(rawToken, context);

    return { user: toAuthUserDto(user), tokens };
  }

  /** Revoca el refresh token actual; sin cookie no hace nada. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.tokens.revoke(rawToken);
  }

  /** Perfil del usuario autenticado (sin `passwordHash`). */
  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.active) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return toAuthUserDto(user);
  }
}
