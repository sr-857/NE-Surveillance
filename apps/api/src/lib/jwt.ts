import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    issuer: 'northeast-watch-api',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'northeast-watch-api',
  }) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings (see lib/crypto.ts randomToken),
 * NOT JWTs — they're looked up by hash against the RefreshToken table so
 * they can be revoked server-side. This module only handles access tokens.
 */
