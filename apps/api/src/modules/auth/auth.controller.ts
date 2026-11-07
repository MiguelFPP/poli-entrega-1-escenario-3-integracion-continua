import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Throttle } from '../../common/decorators/throttle.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { readCookie } from '../../common/http/cookie.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants.js';
import { AuthService, type AuthSession } from './auth.service.js';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto.js';
import { AuthUserDto } from './dto/auth-user.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { sessionContextFrom } from './session-context.js';

/** Máximo de intentos de login por IP y minuto. */
const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

const SET_COOKIE_HEADER = {
  'Set-Cookie': {
    description:
      'Cookies de sesión: `access_token` (httpOnly, `Path=/`, 7 días) y `refresh_token` (httpOnly, `Path=/api/v1/auth`, 7 días). Los tokens no viajan en el body.',
    schema: {
      type: 'string',
      example:
        'access_token=eyJhbGciOiJIUzI1NiJ9...; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax',
    },
  },
} as const;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(LOGIN_RATE_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: [
      'Valida email y contraseña (bcrypt) y que el usuario esté activo.',
      '',
      'Emite un **access token JWT de 15 minutos** y un **refresh token de 7 días**;',
      'ambos se entregan en cookies `httpOnly` (`access_token`, `refresh_token`).',
      'La respuesta no contiene tokens en el body: el navegador no puede leerlos',
      'desde JavaScript.',
      '',
      'Limitado a **5 intentos por minuto e IP**; al excederlo responde `429`.',
      '',
      'Usuarios inexistentes y contraseñas incorrectas devuelven el mismo `401`',
      '(`Credenciales inválidas`) para no filtrar qué emails existen.',
    ].join('\n'),
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      administrador: {
        summary: 'Administrador creado por el seed',
        value: { email: 'admin@pos.local', password: 'Admin123!' },
      },
      emailConMayusculas: {
        summary: 'Email normalizado automáticamente',
        value: { email: '  ADMIN@POS.LOCAL ', password: 'Admin123!' },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Sesión creada. Las cookies `access_token` y `refresh_token` viajan en `Set-Cookie`.',
    type: AuthSessionResponseDto,
    headers: SET_COOKIE_HEADER,
  })
  @ApiUnauthorizedResponse({
    description:
      'Credenciales inválidas, usuario inactivo o payload inválido (`ValidationPipe`).',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: '`Origin` presente y distinto de `WEB_ORIGIN`.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description:
      'Se superaron los 5 intentos por minuto (cabecera `Retry-After`).',
    type: ErrorResponseDto,
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const session = await this.auth.login(dto, sessionContextFrom(request));

    return this.respondWithSession(response, session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotar la sesión',
    description: [
      'Lee la cookie `refresh_token`, valida su hash, expiración y estado.',
      '',
      'Si es válido lo **revoca y emite uno nuevo** (rotación) junto con un access',
      'token fresco. Si el token ya estaba revocado se interpreta como **reuso**',
      '(robo o replay): se revocan **todas** las sesiones del usuario y se',
      'responde `401`, obligando a iniciar sesión de nuevo.',
      '',
      'No requiere access token: la cookie es suficiente.',
    ].join('\n'),
  })
  @ApiCookieAuth('refresh_token')
  @ApiOkResponse({
    description: 'Sesión renovada; ambas cookies se reemplazan.',
    type: AuthSessionResponseDto,
    headers: SET_COOKIE_HEADER,
  })
  @ApiUnauthorizedResponse({
    description:
      'Cookie ausente, token inválido, expirado o revocado (incluye detección de reuso).',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: '`Origin` presente y distinto de `WEB_ORIGIN`.',
    type: ErrorResponseDto,
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const rawToken = readCookie(request, REFRESH_TOKEN_COOKIE);

    if (!rawToken) {
      throw new UnauthorizedException('No hay refresh token en la cookie');
    }

    const session = await this.auth.refresh(
      rawToken,
      sessionContextFrom(request),
    );

    return this.respondWithSession(response, session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: [
      'Revoca el refresh token de la cookie actual y expira ambas cookies.',
      '',
      'El access token es un JWT sin estado: seguirá siendo válido hasta su',
      'expiración (máximo 15 minutos). Requiere sesión activa para poder revocar',
      'el refresh; si no hay cookie de refresh, igual limpia las cookies.',
    ].join('\n'),
  })
  @ApiNoContentResponse({
    description: 'Sesión cerrada y cookies eliminadas.',
    headers: {
      'Set-Cookie': {
        description:
          '`access_token` y `refresh_token` vacías con `Expires` en el pasado (el navegador las elimina).',
        schema: {
          type: 'string',
          example:
            'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Sin access token válido en cookie o `Authorization: Bearer`.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: '`Origin` presente y distinto de `WEB_ORIGIN`.',
    type: ErrorResponseDto,
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(request, REFRESH_TOKEN_COOKIE));
    clearAuthCookies(response, this.secureCookies());
  }

  @Get('me')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Perfil de la sesión actual',
    description: [
      'Devuelve el usuario autenticado **sin `passwordHash`**.',
      '',
      'Se lee el access token de la cookie `access_token`; también se acepta',
      '`Authorization: Bearer <token>` para clientes que no usan cookies.',
      '',
      'Si el usuario fue desactivado o eliminado, responde `401` aunque el JWT siga',
      'vigente (se revalida contra la base de datos).',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Datos del usuario autenticado.',
    type: AuthUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido, expirado o usuario inactivo.',
    type: ErrorResponseDto,
  })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.auth.getProfile(user.id);
  }

  private respondWithSession(
    response: Response,
    session: AuthSession,
  ): AuthSessionResponseDto {
    setAuthCookies(response, session.tokens, this.secureCookies());

    return {
      user: session.user,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    };
  }

  private secureCookies(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
