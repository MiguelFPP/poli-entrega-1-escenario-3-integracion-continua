import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Role } from '../../generated/prisma/client.js';
import type {
  AccessTokenClaims,
  AccessTokenPayload,
} from './types/access-token-payload.js';

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;

const ROLES: readonly string[] = Object.values(Role);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(
      Buffer.from(segment, 'base64url').toString('utf8'),
    ) as unknown;
  } catch {
    return undefined;
  }
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value);
}

/**
 * JWT HS256 mínimo sobre `node:crypto`. Se implementa aquí para no agregar
 * dependencias: firma, verificación de firma con comparación en tiempo
 * constante y validación de `exp`.
 */
@Injectable()
export class JwtService {
  sign(
    claims: AccessTokenClaims,
    secret: string,
    expiresInSeconds: number,
  ): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      ...claims,
      iat: issuedAt,
      exp: issuedAt + expiresInSeconds,
    };

    const body = `${encodeSegment(HEADER)}.${encodeSegment(payload)}`;

    return `${body}.${sign(body, secret)}`;
  }

  /** Devuelve el payload o `null` si la firma, el formato o la expiración fallan. */
  verify(token: string, secret: string): AccessTokenPayload | null {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [headerPart, payloadPart, signaturePart] = parts;

    if (!headerPart || !payloadPart || !signaturePart) {
      return null;
    }

    const expected = Buffer.from(
      sign(`${headerPart}.${payloadPart}`, secret),
      'base64url',
    );
    const provided = Buffer.from(signaturePart, 'base64url');

    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      return null;
    }

    const header = decodeSegment(headerPart);

    if (
      !isRecord(header) ||
      header.alg !== HEADER.alg ||
      header.typ !== HEADER.typ
    ) {
      return null;
    }

    const payload = decodeSegment(payloadPart);

    if (!isRecord(payload)) {
      return null;
    }

    const { sub, email, role, iat, exp } = payload;

    if (typeof sub !== 'string' || sub.length === 0) {
      return null;
    }

    if (typeof email !== 'string' || email.length === 0) {
      return null;
    }

    if (!isRole(role)) {
      return null;
    }

    if (typeof iat !== 'number' || typeof exp !== 'number') {
      return null;
    }

    if (exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { sub, email, role, iat, exp };
  }
}
