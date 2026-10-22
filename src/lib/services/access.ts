import { prisma } from "../db";
import { isListingPublic, isStorePublic, OWNER_STATUS } from "./visibility";

/** Decides who may download a stored file (images, logos, covers, videos, posters). */
export async function mediaAccess(key: string): Promise<{ public: boolean; ownerId: string | null } | null> {
  const storeSel = { status: true, ownerId: true, owner: OWNER_STATUS } as const;
  const img = await prisma.listingImage.findUnique({ where: { key }, select: { listing: { select: { status: true, ownerId: true, owner: OWNER_STATUS, store: { select: storeSel } } } } });
  if (img) return { public: isListingPublic(img.listing), ownerId: img.listing.ownerId };
  const store = await prisma.store.findFirst({ where: { OR: [{ logoKey: key }, { coverKey: key }] }, select: storeSel });
  if (store) return { public: isStorePublic(store), ownerId: store.ownerId };
  const v = await prisma.video.findFirst({
    where: { OR: [{ key }, { posterKey: key }] },
    select: { status: true, processing: true, ownerId: true, listing: { select: { status: true, owner: OWNER_STATUS, store: { select: storeSel } } }, store: { select: storeSel } },
  });
  if (v) {
    const parentPublic = v.listing ? isListingPublic(v.listing) : v.store ? isStorePublic(v.store) : false;
    return { public: v.status === "APPROVED" && v.processing === "READY" && parentPublic, ownerId: v.ownerId };
  }
  return null;
}
