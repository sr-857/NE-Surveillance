import { prisma } from '../../lib/prisma';
import { recordAudit } from '../audit/audit.service';
import { ApiError } from '../../lib/apiError';
import type { Role } from '@prisma/client';

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function changeUserRole(targetUserId: string, newRole: Role, actingUserId: string) {
  if (targetUserId === actingUserId) {
    throw new ApiError(400, 'CANNOT_MODIFY_SELF', 'Use another admin account to change your own role');
  }
  const user = await prisma.user.update({ where: { id: targetUserId }, data: { role: newRole } });
  await recordAudit({
    userId: actingUserId,
    action: 'user.role_changed',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { newRole },
  });
  return user;
}

export async function setUserActive(targetUserId: string, isActive: boolean, actingUserId: string) {
  if (targetUserId === actingUserId) {
    throw new ApiError(400, 'CANNOT_MODIFY_SELF', 'Use another admin account to deactivate your own account');
  }
  const user = await prisma.user.update({ where: { id: targetUserId }, data: { isActive } });
  await recordAudit({
    userId: actingUserId,
    action: isActive ? 'user.reactivated' : 'user.deactivated',
    targetType: 'user',
    targetId: targetUserId,
  });
  return user;
}
