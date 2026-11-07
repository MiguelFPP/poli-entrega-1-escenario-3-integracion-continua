import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import type { UserModel } from '../../generated/prisma/models.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants.js';
import { JwtService } from './jwt.service.js';
import type { SessionContext } from './session-context.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';
import type { IssuedTokens } from './types/issued-tokens.js';

/** Datos del usuario imprescindibles para firmar el access token. */
export type SessionUser = Pick<UserModel, 'id' | 'email' | 'role' | 'active'>;

export type RotatedSession = {
  tokens: IssuedTokens;
  user: UserModel;
};

/**
 * Emisión, rotación y revocación de tokens. El refresh token es opaco
 * (64 bytes aleatorios) y en la base solo se guarda su hash SHA-256.
 */
@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  get accessTokenTtlSeconds(): number {
    return ACCESS_TOKEN_TTL_SECONDS;
  }

  get refreshTokenTtlMs(): number {
    return REFRESH_TOKEN_TTL_MS;
  }

  /** Crea la sesión: access JWT + refresh persistido con su hash. */
  async issueSession(
    user: SessionUser,
    context: SessionContext,
  ): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(user);
    const refresh = this.buildRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
        userAgent: context.userAgent,
        ip: context.ip,
      },
    });

    return { accessToken, refreshToken: refresh.raw };
  }

  /**
   * Rota el refresh token: revoca el recibido y emite uno nuevo.
   * Si el recibido ya estaba revocado se asume reuso y se cierran todas las
   * sesiones del usuario.
   */
  async rotate(
    rawToken: string,
    context: SessionContext,
  ): Promise<RotatedSession> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(
        'Refresh token revocado: se cerraron todas las sesiones',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    if (!stored.user.active) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Usuario inactivo');
    }

    const accessToken = this.signAccessToken(stored.user);
    const refresh = this.buildRefreshToken();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: refresh.hash,
          expiresAt: refresh.expiresAt,
          userAgent: context.userAgent,
          ip: context.ip,
        },
      }),
    ]);

    return {
      tokens: { accessToken, refreshToken: refresh.raw },
      user: stored.user,
    };
  }

  /** Revoca un refresh token concreto (logout). Idempotente. */
  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoca todas las sesiones activas de un usuario. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    return this.jwt.verify(token, this.accessSecret);
  }

  private signAccessToken(
    user: Pick<UserModel, 'id' | 'email' | 'role'>,
  ): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.accessSecret,
      ACCESS_TOKEN_TTL_SECONDS,
    );
  }

  private buildRefreshToken(): {
    raw: string;
    hash: string;
    expiresAt: Date;
  } {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return {
      raw,
      hash: this.hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    };
  }

  /** SHA-256 con `JWT_REFRESH_SECRET` como pepper del hash almacenado. */
  private hashRefreshToken(raw: string): string {
    return createHmac('sha256', this.refreshSecret).update(raw).digest('hex');
  }
}
