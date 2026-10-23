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
  // Invitations timeline images and profile photos: public while the author's account is active.
  const post = await prisma.post.findUnique({ where: { imageKey: key }, select: { authorId: true, author: OWNER_STATUS } });
  if (post) return { public: post.author.status === "ACTIVE", ownerId: post.authorId };
  const u = await prisma.user.findFirst({ where: { avatarKey: key }, select: { id: true, status: true } });
  if (u) return { public: u.status === "ACTIVE", ownerId: u.id };
  return null;
}
