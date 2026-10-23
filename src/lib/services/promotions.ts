import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Session } from "../session";
import type { PromotionStatus } from "../constants";
import { audit } from "./audit";
import { LISTING_PUBLIC, STORE_PUBLIC } from "./visibility";

const DAY = 86_400_000;
export const MAX_PROMO_DAYS = 30;
export const MAX_PENDING_PER_USER = 3 // max live (pending/active) promotions per merchant;

/** Marks APPROVED promotions whose end date passed as EXPIRED. Cheap; called on reads (and could run from cron). */
export async function expirePromotions(now = new Date()) {
  const { count } = await prisma.promotion.updateMany({ where: { status: "APPROVED", endsAt: { lte: now } }, data: { status: "EXPIRED" } });
  return count;
}

function checkDates(startsAt: Date, endsAt: Date, now = new Date()) {
  if (endsAt <= startsAt || endsAt <= now || startsAt.getTime() < now.getTime() - DAY || endsAt.getTime() - startsAt.getTime() > MAX_PROMO_DAYS * DAY) throw new ApiError("INVALID_DATES");
}

export async function requestPromotion(
  input: { targetType: "LISTING" | "STORE"; listingId?: string; storeId?: string; startsAt: Date; endsAt: Date; note: string },
  s: Session,
  opts: { priority?: number; isExample?: boolean } = {},
) {
  if (s.role !== "PROVIDER" && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  checkDates(input.startsAt, input.endsAt);
  let storeId: string;
  let listingId: string | null = null;
  if (input.targetType === "LISTING") {
    const l = await prisma.listing.findUnique({ where: { id: input.listingId! }, select: { ownerId: true, storeId: true } });
    if (!l || !l.storeId) throw new ApiError("NOT_FOUND");
    if (s.role !== "ADMIN" && l.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
    storeId = l.storeId;
    listingId = input.listingId!;
  } else {
    const st = await prisma.store.findUnique({ where: { id: input.storeId! }, select: { ownerId: true } });
    if (!st) throw new ApiError("NOT_FOUND");
    if (s.role !== "ADMIN" && st.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
    storeId = input.storeId!;
  }
  if (s.role !== "ADMIN" && (await prisma.promotion.count({ where: { requestedById: s.sub, status: { in: ["PENDING", "APPROVED"] }, endsAt: { gt: new Date() } } })) >= MAX_PENDING_PER_USER) throw new ApiError("PROMOTION_LIMIT");
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { category: true } });
  const promo = await prisma.promotion.create({
    data: {
      targetType: input.targetType, listingId, storeId, category: store.category, startsAt: input.startsAt, endsAt: input.endsAt,
      note: input.note, requestedById: s.sub, status: "APPROVED", /* merchant content publishes immediately (no admin approval); admins can still reject/expire it */ priority: opts.priority ?? 0, isExample: !!opts.isExample,
    },
  });
  await audit(s, "PROMOTION_CREATED", "PROMOTION", promo.id, { targetType: promo.targetType, storeId });
  return promo;
}

const STRIP_INCLUDE = {
  store: { select: { id: true, slug: true, nameAr: true, nameEn: true, logoKey: true, coverKey: true, video: { select: { status: true, processing: true, key: true, posterKey: true } } } },
  listing: { select: { id: true, nameAr: true, nameEn: true, priceType: true, priceMinor: true, oldPriceMinor: true, currency: true, unitAr: true, unitEn: true, images: { orderBy: { position: "asc" }, take: 1, select: { key: true } }, video: { select: { status: true, processing: true, key: true, posterKey: true } } } },
} satisfies Prisma.PromotionInclude;

/** Active strip: APPROVED, within dates, target public; ordered by priority. */
export async function activePromotions(opts: { category?: string; storeId?: string; limit?: number } = {}, now = new Date()) {
  await expirePromotions(now);
  const rows = await prisma.promotion.findMany({
    where: {
      status: "APPROVED",
      startsAt: { lte: now },
      endsAt: { gt: now },
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.storeId ? { storeId: opts.storeId } : {}),
      store: { is: STORE_PUBLIC },
      OR: [{ targetType: "STORE" }, { targetType: "LISTING", listing: { is: LISTING_PUBLIC } }],
    },
    orderBy: [{ priority: "desc" }, { startsAt: "desc" }],
    take: opts.limit ?? 20,
    include: STRIP_INCLUDE,
  });
  return rows.map((p) => {
    const vid = p.targetType === "LISTING" ? p.listing?.video : p.store.video;
    const approvedVideo = vid?.status === "APPROVED" && vid.processing === "READY" ? vid : null;
    return {
      id: p.id, targetType: p.targetType, priority: p.priority, endsAt: p.endsAt, isExample: p.isExample,
      titleAr: p.targetType === "LISTING" ? p.listing!.nameAr : p.store.nameAr,
      titleEn: p.targetType === "LISTING" ? p.listing!.nameEn : p.store.nameEn,
      store: { slug: p.store.slug, nameAr: p.store.nameAr, nameEn: p.store.nameEn, logoKey: p.store.logoKey },
      href: p.targetType === "LISTING" ? `/p/${p.listingId}` : `/s/${p.store.slug}`,
      price: p.listing ? { priceType: p.listing.priceType, priceMinor: p.listing.priceMinor, oldPriceMinor: p.listing.oldPriceMinor, currency: p.listing.currency, unitAr: p.listing.unitAr, unitEn: p.listing.unitEn } : null,
      imageKey: approvedVideo?.posterKey ?? p.listing?.images[0]?.key ?? p.store.coverKey ?? p.store.logoKey ?? null,
      videoKey: approvedVideo?.key ?? null,
    };
  });
}

export async function myPromotions(userId: string) {
  await expirePromotions();
  return prisma.promotion.findMany({ where: { requestedById: userId }, orderBy: { createdAt: "desc" }, take: 50, include: { listing: { select: { nameAr: true, nameEn: true } }, store: { select: { nameAr: true, nameEn: true } } } });
}

export async function cancelPromotion(id: string, s: Session) {
  const p = await prisma.promotion.findUnique({ where: { id } });
  if (!p) throw new ApiError("NOT_FOUND");
  if (s.role !== "ADMIN" && p.requestedById !== s.sub) throw new ApiError("FORBIDDEN");
  if (s.role !== "ADMIN" && !["PENDING", "APPROVED"].includes(p.status)) throw new ApiError("FORBIDDEN");
  await prisma.promotion.delete({ where: { id } });
}

export async function adminUpdatePromotion(id: string, change: { status?: PromotionStatus; priority?: number; startsAt?: Date; endsAt?: Date }, admin: Session) {
  await expirePromotions();
  const p = await prisma.promotion.findUnique({ where: { id } });
  if (!p) throw new ApiError("NOT_FOUND");
  const startsAt = change.startsAt ?? p.startsAt;
  const endsAt = change.endsAt ?? p.endsAt;
  if (change.startsAt || change.endsAt) {
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > MAX_PROMO_DAYS * DAY) throw new ApiError("INVALID_DATES");
  }
  if (change.status === "APPROVED" && endsAt <= new Date()) throw new ApiError("PROMOTION_ENDED");
  if (change.status === "EXPIRED" && p.status !== "APPROVED") throw new ApiError("VALIDATION", [{ field: "status", message: "status" }]);
  const updated = await prisma.promotion.update({ where: { id }, data: change });
  await audit(admin, "PROMOTION_UPDATED", "PROMOTION", id, { from: p.status, to: updated.status, priority: updated.priority, startsAt: updated.startsAt, endsAt: updated.endsAt });
  return updated;
}

export async function adminListPromotions(status: string | undefined, page: number, pageSize: number) {
  await expirePromotions();
  const where = status ? { status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.promotion.findMany({ where, orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize, include: { listing: { select: { id: true, nameAr: true, nameEn: true } }, store: { select: { slug: true, nameAr: true, nameEn: true } }, requestedBy: { select: { email: true } } } }),
    prisma.promotion.count({ where }),
  ]);
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
