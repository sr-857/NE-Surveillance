import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/apiError';
import type { RegionType } from '@prisma/client';

async function getOrCreateDefaultWatchlist(userId: string) {
  const existing = await prisma.watchlist.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.watchlist.create({ data: { userId, name: 'My Watchlist' } });
}

export async function getWatchlist(userId: string) {
  const list = await getOrCreateDefaultWatchlist(userId);
  return prisma.watchlist.findUnique({
    where: { id: list.id },
    include: { items: true },
  });
}

export async function addToWatchlist(userId: string, regionType: RegionType, regionCode: string) {
  const region = await prisma.region.findUnique({ where: { code: regionCode } });
  if (!region) throw new ApiError(404, 'REGION_NOT_FOUND', `Unknown region code: ${regionCode}`);

  const list = await getOrCreateDefaultWatchlist(userId);
  return prisma.watchlistItem.upsert({
    where: { watchlistId_regionType_regionCode: { watchlistId: list.id, regionType, regionCode } },
    update: {},
    create: { watchlistId: list.id, regionType, regionCode },
  });
}

export async function removeFromWatchlist(userId: string, itemId: string) {
  const item = await prisma.watchlistItem.findUnique({ where: { id: itemId }, include: { watchlist: true } });
  if (!item || item.watchlist.userId !== userId) {
    throw new ApiError(404, 'WATCHLIST_ITEM_NOT_FOUND', 'Watchlist item not found');
  }
  await prisma.watchlistItem.delete({ where: { id: itemId } });
}
