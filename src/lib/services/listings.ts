import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Session } from "../session";
import type { ListQuery, ListingInput } from "../validation";
import type { Sort, Status } from "../constants";
import { ZodError } from "zod";
import { priceProblem } from "../validation";
import { storage } from "../storage";
import { audit } from "./audit";
import { normalize } from "./text";
import { LISTING_PUBLIC, isListingPublic, OWNER_STATUS } from "./visibility";
import { compactFeatured, unfeature } from "./stores";
import { type UploadInput, storeImage } from "./media";
import { videoKeys } from "./videos";

export { normalize };
export const MAX_IMAGES = 4;

const buildSearch = (p: { nameAr: string; nameEn: string; descAr: string; descEn: string }) => normalize([p.nameAr, p.nameEn, p.descAr, p.descEn].join(" "));
const STORE_BRIEF = { select: { id: true, slug: true, nameAr: true, nameEn: true, logoKey: true } } as const;

function where(q: Partial<ListQuery> & { status?: Status; ownerId?: string; storeId?: string }): Prisma.ListingWhereInput {
  const w: Prisma.ListingWhereInput = {};
  if (q.status) w.status = q.status;
  if (q.category) w.category = q.category;
  if (q.subcategory) w.subcategory = q.subcategory;
  if (q.ownerId) w.ownerId = q.ownerId;
  if (q.storeId) w.storeId = q.storeId;
  const range = priceRange(q);
  if (range) w.priceMinor = range;
  if (q.q) w.AND = normalize(q.q).split(" ").filter(Boolean).slice(0, 5).map((t) => ({ searchText: { contains: t } }));
  return w;
}

/** minPrice/maxPrice are in major units (EGP); stored prices are minor units. */
export function priceRange(q: { minPrice?: number; maxPrice?: number }): Prisma.IntNullableFilter | undefined {
  if (q.minPrice == null && q.maxPrice == null) return undefined;
  return { not: null, ...(q.minPrice != null ? { gte: Math.round(q.minPrice * 100) } : {}), ...(q.maxPrice != null ? { lte: Math.round(q.maxPrice * 100) } : {}) };
}
export function listingOrder(sort: Sort | undefined): Prisma.ListingOrderByWithRelationInput[] {
  if (sort === "price_asc") return [{ priceMinor: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
  if (sort === "price_desc") return [{ priceMinor: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
  return [{ available: "desc" }, { createdAt: "desc" }];
}
function assertPrice(v: { priceType?: string; priceMinor?: number | null; oldPriceMinor?: number | null }) {
  const p = priceProblem(v);
  if (p) throw new ZodError([{ code: "custom", path: [p[0]], message: p[1] }]);
}

export async function listListings(q: Omit<ListQuery, "sort"> & { sort?: Sort } & { status?: Status; ownerId?: string; storeId?: string; publicOnly?: boolean }) {
  const w = q.publicOnly ? { AND: [where(q), LISTING_PUBLIC] } : { AND: [where(q), { deletedAt: null }] };
  const [items, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where: w,
      orderBy: listingOrder(q.sort),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      omit: { searchText: true },
      include: { images: { orderBy: { position: "asc" } }, store: STORE_BRIEF },
    }),
    prisma.listing.count({ where: w }),
  ]);
  return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}
export const listPublic = (q: ListQuery) => listListings({ ...q, publicOnly: true });

export async function getListing(id: string, viewer?: Session | null) {
  const found = await prisma.listing.findUnique({
    where: { id },
    omit: { searchText: true },
    include: {
      images: { orderBy: { position: "asc" } },
      video: true,
      owner: OWNER_STATUS,
      store: { select: { ...STORE_BRIEF.select, status: true, deletedAt: true, latitude: true, longitude: true, addressAr: true, addressEn: true, phone: true, whatsapp: true, owner: OWNER_STATUS } },
    },
  });
  if (!found || found.deletedAt || found.store?.deletedAt) throw new ApiError("NOT_FOUND");
  const canManage = !!viewer && (viewer.role === "ADMIN" || viewer.sub === found.ownerId);
  if (!isListingPublic(found) && !canManage) throw new ApiError("NOT_FOUND");
  const { owner: _o, video, store, ...p } = found;
  void _o;
  return {
    ...p,
    store: store ? { id: store.id, slug: store.slug, nameAr: store.nameAr, nameEn: store.nameEn, logoKey: store.logoKey, latitude: store.latitude, longitude: store.longitude, addressAr: store.addressAr, addressEn: store.addressEn } : null,
    video: video && ((video.status === "APPROVED" && video.processing === "READY") || canManage) ? video : null,
  };
}

async function ownedOrAdmin(id: string, s: Session) {
  const p = await prisma.listing.findUnique({ where: { id } });
  if (!p || p.deletedAt) throw new ApiError("NOT_FOUND");
  if (s.role !== "ADMIN" && p.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
  return p;
}

async function assertGroup(groupId: string | null | undefined, storeId: string | null) {
  if (!groupId) return;
  const g = await prisma.listingGroup.findUnique({ where: { id: groupId } });
  if (!g || g.storeId !== storeId) throw new ApiError("VALIDATION", [{ field: "groupId", message: "group" }]);
}

/** Creates a listing inside the caller's store (or `storeId` for admins/owners). */
export async function createListing(input: ListingInput, s: Session) {
  if (s.role !== "PROVIDER" && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user) throw new ApiError("UNAUTHORIZED");
  if (s.role !== "ADMIN" && !user.emailVerified) throw new ApiError("EMAIL_NOT_VERIFIED");
  const store = input.storeId
    ? await prisma.store.findUnique({ where: { id: input.storeId } })
    : await prisma.store.findFirst({ where: { ownerId: s.sub }, orderBy: { createdAt: "asc" } });
  if (!store) throw new ApiError(input.storeId ? "NOT_FOUND" : "STORE_REQUIRED");
  if (s.role !== "ADMIN" && store.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
  await assertGroup(input.groupId, store.id);
  const { storeId: _sid, ...rest } = input;
  void _sid;
  assertPrice(rest);
  if (rest.priceType === "ON_REQUEST") { rest.priceMinor = null; rest.oldPriceMinor = null; }
  const data = { ...rest, phone: rest.phone ?? store.phone, whatsapp: rest.whatsapp ?? store.whatsapp };
  return prisma.listing.create({
    data: {
      ...data,
      storeId: store.id,
      ownerId: store.ownerId,
      category: store.category,
      subcategory: store.subcategory,
      searchText: buildSearch(data),
      status: "APPROVED", // published immediately; admins can hide (audited)
    },
    omit: { searchText: true },
  });
}

export async function updateListing(id: string, input: Partial<Omit<ListingInput, "storeId">>, s: Session) {
  const cur = await ownedOrAdmin(id, s);
  if ("groupId" in input) await assertGroup(input.groupId, cur.storeId);
  // Switching to "on request" clears stored amounts unless the caller sent new ones.
  if (input.priceType === "ON_REQUEST") { input.priceMinor ??= null; input.oldPriceMinor ??= null; }
  const merged = { ...cur, ...input };
  assertPrice(merged);
  const contentChanged = (["nameAr", "nameEn", "descAr", "descEn"] as const).some((k) => k in input && input[k] !== cur[k]);
  const backToReview = false; // products publish immediately (no re-review on edit)
  void contentChanged;
  const updated = await prisma.listing.update({
    where: { id },
    data: { ...input, searchText: buildSearch(merged), ...(backToReview ? { status: "PENDING", featuredPosition: null } : {}) },
    omit: { searchText: true },
  });
  if (backToReview && cur.storeId && cur.featuredPosition != null) await compactFeatured(cur.storeId);
  return updated;
}

export async function setAvailability(id: string, available: boolean, s: Session) {
  await ownedOrAdmin(id, s);
  return prisma.listing.update({ where: { id }, data: { available }, omit: { searchText: true } });
}

export async function deleteListing(id: string, s: Session) {
  const cur = await ownedOrAdmin(id, s);
  const imgs = await prisma.listingImage.findMany({ where: { listingId: id } });
  const video = await prisma.video.findUnique({ where: { listingId: id } });
  await prisma.listing.delete({ where: { id } });
  if (cur.storeId && cur.featuredPosition != null) await compactFeatured(cur.storeId);
  await Promise.all([...imgs.map((i) => i.key), ...(video ? videoKeys(video) : [])].map((k) => storage.delete(k).catch(() => {})));
}

export async function setListingStatus(id: string, status: Status, s: Session) {
  if (s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  const p = await prisma.listing.findUnique({ where: { id } });
  if (!p) throw new ApiError("NOT_FOUND");
  const updated = await prisma.listing.update({ where: { id }, data: { status }, omit: { searchText: true } });
  if (status !== "APPROVED") await unfeature(id); // hidden/pending listings can't stay featured
  if (p.status !== status) await audit(s, "LISTING_STATUS_CHANGED", "LISTING", id, { name: p.nameEn, from: p.status, to: status });
  return updated;
}

export async function addListingImage(listingId: string, file: UploadInput, s: Session) {
  await ownedOrAdmin(listingId, s);
  const count = await prisma.listingImage.count({ where: { listingId } });
  if (count >= MAX_IMAGES) throw new ApiError("TOO_MANY_IMAGES");
  const img = await storeImage(file, `listings/${listingId}`);
  return prisma.listingImage.create({ data: { listingId, ...img, position: count } });
}

export async function deleteListingImage(listingId: string, imageId: string, s: Session) {
  await ownedOrAdmin(listingId, s);
  const img = await prisma.listingImage.findFirst({ where: { id: imageId, listingId } });
  if (!img) throw new ApiError("NOT_FOUND");
  await prisma.listingImage.delete({ where: { id: img.id } });
  await storage.delete(img.key);
}
