import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Session } from "../session";
import type { StoreInput } from "../validation";
import { MAX_FEATURED, type Status } from "../constants";
import { storage } from "../storage";
import { audit } from "./audit";
import { normalize } from "./text";
import { LISTING_PUBLIC, STORE_PUBLIC, isStorePublic, OWNER_STATUS } from "./visibility";
import { type UploadInput, storeImage } from "./media";
import { listingOrder, priceRange } from "./listings";
import type { Sort } from "../constants";

const storeSearch = (s: { nameAr: string; nameEn: string; bioAr: string; bioEn: string; area: string }) =>
  normalize([s.nameAr, s.nameEn, s.bioAr, s.bioEn, s.area].join(" "));

async function uniqueSlug(nameEn: string) {
  const base = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "store";
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${crypto.randomBytes(2).toString("hex")}`;
    if (!(await prisma.store.findUnique({ where: { slug } }))) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Loads a store and checks the caller owns it (or is admin). */
export async function ownStore(id: string, s: Session) {
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) throw new ApiError("NOT_FOUND");
  if (s.role !== "ADMIN" && store.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
  return store;
}

export const getMyStore = (userId: string) =>
  prisma.store.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, omit: { searchText: true }, include: { video: true, groups: { orderBy: { position: "asc" } } } });

export async function createStore(input: StoreInput, s: Session) {
  if (s.role !== "PROVIDER" && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user) throw new ApiError("UNAUTHORIZED");
  if (s.role !== "ADMIN" && !user.emailVerified) throw new ApiError("EMAIL_NOT_VERIFIED");
  // One store per provider for now; the schema already allows more.
  if (await prisma.store.count({ where: { ownerId: s.sub } })) throw new ApiError("STORE_EXISTS");
  const data = { ...input, subcategory: input.category === "medical" ? input.subcategory ?? null : null };
  return prisma.store.create({
    data: { ...data, slug: await uniqueSlug(data.nameEn), ownerId: s.sub, searchText: storeSearch(data), status: s.role === "ADMIN" ? "APPROVED" : "PENDING" },
    omit: { searchText: true },
  });
}

export async function updateStore(id: string, input: Partial<StoreInput>, s: Session) {
  const cur = await ownStore(id, s);
  const merged = { ...cur, ...input };
  if (merged.category !== "medical") merged.subcategory = null;
  // Renaming or moving section needs re-approval; bio/contact edits don't.
  const sensitive = ["nameAr", "nameEn", "category", "subcategory"].some((k) => k in input && (input as Record<string, unknown>)[k] !== (cur as Record<string, unknown>)[k]);
  const sectionChanged = merged.category !== cur.category || merged.subcategory !== cur.subcategory;
  const [store] = await prisma.$transaction([
    prisma.store.update({
      where: { id },
      data: { ...input, subcategory: merged.subcategory, searchText: storeSearch(merged), ...(sensitive && s.role !== "ADMIN" && cur.status === "APPROVED" ? { status: "PENDING" } : {}) },
      omit: { searchText: true },
    }),
    ...(sectionChanged
      ? [
          prisma.listing.updateMany({ where: { storeId: id }, data: { category: merged.category, subcategory: merged.subcategory } }),
          prisma.promotion.updateMany({ where: { storeId: id }, data: { category: merged.category } }),
        ]
      : []),
  ]);
  return store;
}

export async function setStoreImage(id: string, kind: "logo" | "cover", file: UploadInput, s: Session) {
  const cur = await ownStore(id, s);
  const img = await storeImage(file, `stores/${id}`, kind === "logo" ? { width: 400, height: 400, fit: "cover" } : { width: 1600, height: 600, fit: "cover" });
  const old = kind === "logo" ? cur.logoKey : cur.coverKey;
  const store = await prisma.store.update({ where: { id }, data: kind === "logo" ? { logoKey: img.key } : { coverKey: img.key }, omit: { searchText: true } });
  if (old) await storage.delete(old).catch(() => {});
  return store;
}

export async function setStoreStatus(id: string, status: Status, admin: Session) {
  const cur = await prisma.store.findUnique({ where: { id } });
  if (!cur) throw new ApiError("NOT_FOUND");
  const store = await prisma.store.update({ where: { id }, data: { status }, omit: { searchText: true } });
  if (cur.status !== status) await audit(admin, "STORE_STATUS_CHANGED", "STORE", id, { name: cur.nameEn, from: cur.status, to: status });
  return store;
}

/** Featured items first (1..3); if the store featured nothing, its first items in catalog order. */
const FEATURED_SELECT = {
  where: { ...LISTING_PUBLIC },
  orderBy: [{ featuredPosition: { sort: "asc", nulls: "last" } }, { available: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  take: MAX_FEATURED,
  omit: { searchText: true },
  include: { images: { orderBy: { position: "asc" }, take: 1 } },
} satisfies Prisma.Store$listingsArgs;

/** Category page: public stores in a section, each with its featured listings (max 3). */
type StoreQuery = { category?: string; subcategory?: string; q?: string; sort?: Sort; minPrice?: number; maxPrice?: number; page: number; pageSize: number };
const STORE_INCLUDE = { listings: FEATURED_SELECT, _count: { select: { listings: { where: LISTING_PUBLIC } } } } satisfies Prisma.StoreInclude;

/**
 * Category page: public stores in a section, each with its featured listings (max 3).
 * Price filter keeps stores that have at least one public listing in range.
 * Price sort orders stores by their cheapest (or most expensive) public listing; stores
 * with no priced listing are left out of a price-sorted view.
 */
export async function listStores(q: StoreQuery) {
  const where: Prisma.StoreWhereInput = { ...STORE_PUBLIC };
  if (q.category) where.category = q.category;
  if (q.subcategory) where.subcategory = q.subcategory;
  if (q.q) where.AND = normalize(q.q).split(" ").filter(Boolean).slice(0, 5).map((t) => ({ searchText: { contains: t } }));
  const range = priceRange(q);
  if (range) where.listings = { some: { ...LISTING_PUBLIC, priceMinor: range } };
  const shape = <T extends { listings: unknown[]; _count: { listings: number } }>(rows: T[]) =>
    rows.map(({ listings, _count, ...st }) => ({ ...st, featured: listings as T["listings"], listingCount: _count.listings }));

  if (q.sort === "price_asc" || q.sort === "price_desc") {
    const lw: Prisma.ListingWhereInput = { ...LISTING_PUBLIC, priceMinor: range ?? { not: null }, storeId: { not: null }, store: { is: where } };
    const all = await prisma.listing.groupBy({ by: ["storeId"], where: lw, _min: { priceMinor: true }, _max: { priceMinor: true } });
    const key = (r: (typeof all)[number]) => (q.sort === "price_asc" ? r._min.priceMinor! : -r._max.priceMinor!);
    const ordered = all.sort((a, b) => key(a) - key(b)).map((r) => r.storeId!);
    const pageIds = ordered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    const rows = await prisma.store.findMany({ where: { id: { in: pageIds } }, omit: { searchText: true }, include: STORE_INCLUDE });
    const items = shape(pageIds.map((id) => rows.find((r) => r.id === id)!).filter(Boolean));
    return { items, page: q.page, pageSize: q.pageSize, total: ordered.length, totalPages: Math.max(1, Math.ceil(ordered.length / q.pageSize)) };
  }
  const [rows, total] = await prisma.$transaction([
    prisma.store.findMany({ where, orderBy: [{ createdAt: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, omit: { searchText: true }, include: STORE_INCLUDE }),
    prisma.store.count({ where }),
  ]);
  return { items: shape(rows), page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** Store page: header, approved video, featured, groups and paginated approved listings. */
export async function storePage(slug: string, viewer: Session | null, q: { group?: string; sort?: Sort; minPrice?: number; maxPrice?: number; page: number; pageSize: number }) {
  const store = await prisma.store.findUnique({
    where: { slug },
    omit: { searchText: true },
    include: { owner: OWNER_STATUS, video: true, groups: { orderBy: { position: "asc" }, include: { _count: { select: { listings: { where: LISTING_PUBLIC } } } } } },
  });
  if (!store) throw new ApiError("NOT_FOUND");
  const canManage = !!viewer && (viewer.role === "ADMIN" || viewer.sub === store.ownerId);
  if (!isStorePublic(store) && !canManage) throw new ApiError("NOT_FOUND");
  const range = priceRange(q);
  // Default view: featured listings are shown in their own section, so "all listings" excludes them (no duplicates).
  // With a group tab or price filter active, the featured section is hidden and every match is listed once.
  const defaultView = !q.group && !range;
  const lw: Prisma.ListingWhereInput = { storeId: store.id, status: "APPROVED", ...(q.group ? { groupId: q.group } : {}), ...(range ? { priceMinor: range } : {}), ...(defaultView ? { featuredPosition: null } : {}) };
  const [featured, listings, total] = await prisma.$transaction([
    prisma.listing.findMany({ where: { storeId: store.id, status: "APPROVED", featuredPosition: { not: null } }, orderBy: { featuredPosition: "asc" }, take: MAX_FEATURED, omit: { searchText: true }, include: { images: { orderBy: { position: "asc" }, take: 1 } } }),
    prisma.listing.findMany({ where: lw, orderBy: listingOrder(q.sort), skip: (q.page - 1) * q.pageSize, take: q.pageSize, omit: { searchText: true }, include: { images: { orderBy: { position: "asc" }, take: 1 } } }),
    prisma.listing.count({ where: lw }),
  ]);
  const { owner: _o, video, groups, ...rest } = store;
  void _o;
  return {
    store: rest,
    video: video && ((video.status === "APPROVED" && video.processing === "READY") || canManage) ? video : null,
    groups: groups.map(({ _count, ...g }) => ({ ...g, count: _count.listings })),
    featured: defaultView ? featured : [],
    listings: { items: listings, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
    public: isStorePublic(store),
  };
}

/** Replace the featured set: up to 3 of the store's own APPROVED listings, in the given order. */
export async function setFeatured(storeId: string, listingIds: string[], s: Session) {
  await ownStore(storeId, s);
  if (listingIds.length > MAX_FEATURED) throw new ApiError("FEATURED_LIMIT");
  const found = await prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, storeId: true, status: true } });
  for (const id of listingIds) {
    const l = found.find((x) => x.id === id);
    if (!l) throw new ApiError("NOT_FOUND");
    if (l.storeId !== storeId) throw new ApiError("FORBIDDEN");
    if (l.status !== "APPROVED") throw new ApiError("NOT_APPROVED");
  }
  await prisma.$transaction([
    prisma.listing.updateMany({ where: { storeId, featuredPosition: { not: null } }, data: { featuredPosition: null } }),
    ...listingIds.map((id, i) => prisma.listing.update({ where: { id }, data: { featuredPosition: i + 1 } })),
  ]);
  return prisma.listing.findMany({ where: { storeId, featuredPosition: { not: null } }, orderBy: { featuredPosition: "asc" }, select: { id: true, featuredPosition: true } });
}

/** Remove a listing from the featured set and close the gap (1..n). */
export async function unfeature(listingId: string) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { storeId: true, featuredPosition: true } });
  if (!l?.storeId || l.featuredPosition == null) return;
  await prisma.listing.update({ where: { id: listingId }, data: { featuredPosition: null } });
  await compactFeatured(l.storeId);
}
export async function compactFeatured(storeId: string) {
  const rest = await prisma.listing.findMany({ where: { storeId, featuredPosition: { not: null } }, orderBy: { featuredPosition: "asc" }, select: { id: true } });
  await prisma.$transaction(rest.map((r, i) => prisma.listing.update({ where: { id: r.id }, data: { featuredPosition: i + 1 } })));
}

export async function addGroup(storeId: string, g: { nameAr: string; nameEn: string; position?: number }, s: Session) {
  await ownStore(storeId, s);
  if ((await prisma.listingGroup.count({ where: { storeId } })) >= 20) throw new ApiError("VALIDATION", [{ field: "groups", message: "max 20" }]);
  const position = g.position ?? (await prisma.listingGroup.count({ where: { storeId } }));
  return prisma.listingGroup.create({ data: { storeId, nameAr: g.nameAr, nameEn: g.nameEn, position } });
}
async function ownGroup(storeId: string, groupId: string, s: Session) {
  await ownStore(storeId, s);
  const g = await prisma.listingGroup.findUnique({ where: { id: groupId } });
  if (!g || g.storeId !== storeId) throw new ApiError("NOT_FOUND");
  return g;
}
export async function updateGroup(storeId: string, groupId: string, g: Partial<{ nameAr: string; nameEn: string; position: number }>, s: Session) {
  await ownGroup(storeId, groupId, s);
  return prisma.listingGroup.update({ where: { id: groupId }, data: g });
}
export async function deleteGroup(storeId: string, groupId: string, s: Session) {
  await ownGroup(storeId, groupId, s);
  await prisma.listingGroup.delete({ where: { id: groupId } }); // listings keep existing (groupId -> null)
}

export async function adminListStores(status: string | undefined, page: number, pageSize: number) {
  const where: Prisma.StoreWhereInput = status ? { status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.store.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, omit: { searchText: true }, include: { owner: { select: { email: true, status: true } }, _count: { select: { listings: true } } } }),
    prisma.store.count({ where }),
  ]);
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Number of public stores per section (home page). */
export async function storeCounts() {
  const rows = await prisma.store.groupBy({ by: ["category"], where: STORE_PUBLIC, _count: true });
  return Object.fromEntries(rows.map((r) => [r.category, r._count])) as Record<string, number>;
}
