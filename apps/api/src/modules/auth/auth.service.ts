import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword, hashToken, randomToken } from '../../lib/crypto';
import { signAccessToken } from '../../lib/jwt';
import { ApiError } from '../../lib/apiError';
import { env } from '../../config/env';
import { recordAudit } from '../audit/audit.service';
import { Role } from '@prisma/client';

interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function issueTokenPair(userId: string, email: string, role: Role, family?: string): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId, email, role });
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      family: family ?? randomUUID(),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
    },
  });
  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export async function register(
  input: { email: string; password: string; displayName: string },
  ctx: AuthContext,
): Promise<TokenPair> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Deliberately vague — do not reveal whether an email is registered (user enumeration).
    throw new ApiError(409, 'REGISTRATION_FAILED', 'Unable to register with the provided details');
  }

  const passwordHash = await hashPassword(input.password);
  // New self-registrations are always VIEWER (read-only). Role elevation is an
  // explicit ADMIN action via /users/:id/role — never client-controlled at signup.
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, displayName: input.displayName, role: Role.VIEWER },
  });

  await recordAudit({
    userId: user.id,
    action: 'auth.register',
    targetType: 'user',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return issueTokenPair(user.id, user.email, user.role);
}

export async function login(
  input: { email: string; password: string },
  ctx: AuthContext,
): Promise<TokenPair> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Constant-shape failure path: always run a bcrypt compare even when the
  // user doesn't exist, against a dummy hash, so response timing doesn't leak
  // whether the email is registered.
  const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOx8XOWa2ZR7c6c1p9nAcyBv5vR1F8Rti';
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid || !user.isActive) {
    await recordAudit({
      action: 'auth.login_failed',
      metadata: { email: input.email },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    userId: user.id,
    action: 'auth.login',
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return issueTokenPair(user.id, user.email, user.role);
}

/**
 * Refresh token rotation with reuse detection: each refresh consumes the
 * presented token and issues a new one in the same "family". If a token is
 * presented that's already been revoked (i.e. someone is replaying a stolen
 * token after the legitimate client already rotated past it), the ENTIRE
 * family is revoked — this is the standard mitigation for refresh token theft.
 */
export async function refresh(rawToken: string, ctx: AuthContext): Promise<TokenPair> {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token not recognized');

  if (stored.revokedAt || stored.expiresAt < new Date()) {
    // Reuse of a revoked/rotated-out token — treat as compromised, kill the whole family.
    await prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit({
      userId: stored.userId,
      action: 'auth.refresh_token_reuse_detected',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new ApiError(401, 'REFRESH_TOKEN_REUSED', 'Session invalidated — please log in again');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  if (!stored.user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  return issueTokenPair(stored.userId, stored.user.email, stored.user.role, stored.family);
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await recordAudit({ userId, action: 'auth.logout_all_sessions' });
}
