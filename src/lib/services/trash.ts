import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Session } from "../session";
import { storage } from "../storage";
import { audit } from "./audit";
import { compactFeatured } from "./stores";

/** Soft-deleted stores/products stay restorable for this long, then the cleanup cron purges rows + files. */
export const TRASH_DAYS = 30;
const DAY = 24 * 3600_000;

function admin(s: Session) {
  if (s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
}
/** Best-effort cache invalidation (pages are dynamic; this also drops any Next data/router cache). */
export async function revalidatePublic(paths: string[] = []) {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
    for (const p of paths) revalidatePath(p);
  } catch { /* outside a request (tests/cron) */ }
}

export async function softDeleteStore(id: string, s: Session) {
  admin(s);
  const st = await prisma.store.findUnique({ where: { id } });
  if (!st) throw new ApiError("NOT_FOUND");
  if (st.deletedAt) return st;
  const now = new Date();
  // Products of a deleted store are hidden by STORE_PUBLIC; featured slots + promotions are cleared too.
  const [updated] = await prisma.$transaction([
    prisma.store.update({ where: { id }, data: { deletedAt: now } }),
    prisma.listing.updateMany({ where: { storeId: id }, data: { featuredPosition: null } }),
    prisma.promotion.updateMany({ where: { storeId: id, status: { in: ["PENDING", "APPROVED"] } }, data: { status: "REJECTED" } }),
  ]);
  await audit(s, "STORE_DELETED", "STORE", id, { name: st.nameEn, slug: st.slug, purgeAfterDays: TRASH_DAYS });
  await revalidatePublic([`/s/${st.slug}`, `/en/s/${st.slug}`]);
  return updated;
}
export async function restoreStore(id: string, s: Session) {
  admin(s);
  const st = await prisma.store.findUnique({ where: { id } });
  if (!st?.deletedAt) throw new ApiError("NOT_FOUND");
  const updated = await prisma.store.update({ where: { id }, data: { deletedAt: null } });
  await audit(s, "STORE_RESTORED", "STORE", id, { name: st.nameEn });
  await revalidatePublic();
  return updated;
}
async function storeKeys(id: string) {
  const [st, imgs, vids] = await Promise.all([
    prisma.store.findUnique({ where: { id }, select: { logoKey: true, coverKey: true } }),
    prisma.listingImage.findMany({ where: { listing: { storeId: id } }, select: { key: true } }),
    prisma.video.findMany({ where: { OR: [{ storeId: id }, { listing: { storeId: id } }] }, select: { key: true, posterKey: true, sourceKey: true } }),
  ]);
  return [st?.logoKey, st?.coverKey, ...imgs.map((i) => i.key), ...vids.flatMap((v) => [v.key, v.posterKey, v.sourceKey])].filter(Boolean) as string[];
}
async function dropFiles(keys: string[]) {
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => {})));
}
/** Irreversible: rows (cascade: products, images, videos, sections, promotions) + stored files. */
export async function purgeStore(id: string, s: Session | null) {
  if (s) admin(s);
  const st = await prisma.store.findUnique({ where: { id } });
  if (!st) throw new ApiError("NOT_FOUND");
  const keys = await storeKeys(id);
  await prisma.listing.deleteMany({ where: { storeId: id } });
  await prisma.store.delete({ where: { id } });
  await dropFiles(keys);
  if (s) await audit(s, "STORE_PURGED", "STORE", id, { name: st.nameEn, slug: st.slug, files: keys.length });
  await revalidatePublic();
}

export async function softDeleteListing(id: string, s: Session) {
  admin(s);
  const l = await prisma.listing.findUnique({ where: { id } });
  if (!l) throw new ApiError("NOT_FOUND");
  if (l.deletedAt) return l;
  const updated = await prisma.listing.update({ where: { id }, data: { deletedAt: new Date(), featuredPosition: null } });
  if (l.storeId && l.featuredPosition != null) await compactFeatured(l.storeId);
  await prisma.promotion.updateMany({ where: { listingId: id, status: { in: ["PENDING", "APPROVED"] } }, data: { status: "REJECTED" } });
  await audit(s, "LISTING_DELETED", "LISTING", id, { name: l.nameEn, purgeAfterDays: TRASH_DAYS });
  await revalidatePublic([`/p/${id}`]);
  return updated;
}
export async function restoreListing(id: string, s: Session) {
  admin(s);
  const l = await prisma.listing.findUnique({ where: { id } });
  if (!l?.deletedAt) throw new ApiError("NOT_FOUND");
  const updated = await prisma.listing.update({ where: { id }, data: { deletedAt: null } });
  await audit(s, "LISTING_RESTORED", "LISTING", id, { name: l.nameEn });
  await revalidatePublic();
  return updated;
}
export async function purgeListing(id: string, s: Session | null) {
  if (s) admin(s);
  const l = await prisma.listing.findUnique({ where: { id }, include: { images: { select: { key: true } }, video: true } });
  if (!l) throw new ApiError("NOT_FOUND");
  const keys = [...l.images.map((i) => i.key), ...(l.video ? [l.video.key, l.video.posterKey, l.video.sourceKey] : [])].filter(Boolean) as string[];
  await prisma.listing.delete({ where: { id } });
  if (l.storeId && l.featuredPosition != null) await compactFeatured(l.storeId);
  await dropFiles(keys);
  if (s) await audit(s, "LISTING_PURGED", "LISTING", id, { name: l.nameEn, files: keys.length });
  await revalidatePublic();
}

/** Cron: permanently remove anything soft-deleted more than TRASH_DAYS ago. */
export async function purgeExpiredTrash(now = Date.now()) {
  const cutoff = new Date(now - TRASH_DAYS * DAY);
  const stores = await prisma.store.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  for (const st of stores) await purgeStore(st.id, null);
  const listings = await prisma.listing.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  for (const l of listings) await purgeListing(l.id, null);
  return { stores: stores.length, listings: listings.length };
}

export async function adminTrash() {
  const [stores, listings] = await Promise.all([
    prisma.store.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100, select: { id: true, nameAr: true, nameEn: true, slug: true, deletedAt: true, owner: { select: { email: true } } } }),
    prisma.listing.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100, select: { id: true, nameAr: true, nameEn: true, deletedAt: true, store: { select: { nameAr: true, nameEn: true } } } }),
  ]);
  return { stores, listings };
}

/** Stores owned by admin accounts (admins must not own stores; shown as a warning on /admin). */
export const adminOwnedStores = () =>
  prisma.store.findMany({ where: { deletedAt: null, owner: { role: "ADMIN" } }, select: { id: true, nameAr: true, nameEn: true, slug: true, owner: { select: { email: true } } } });
