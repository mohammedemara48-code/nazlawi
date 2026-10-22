/**
 * Merchant catalog: a store's sections (ListingGroup) and products (Listing with a required price + unit).
 * Products publish immediately (status APPROVED); admins can hide/unhide (audited, see listings.setListingStatus).
 * Every function checks ownership (owner or ADMIN).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Session } from "../session";
import { MAX_FEATURED, MAX_PRODUCTS, MAX_SECTIONS } from "../constants";
import type { ProductInput } from "../validation";
import { normalize } from "./text";
import { ownStore, compactFeatured } from "./stores";
import { isStorePublic, OWNER_STATUS } from "./visibility";
import { deleteListing } from "./listings";

const search = (p: { nameAr: string; nameEn: string; descAr: string; descEn: string }) => normalize([p.nameAr, p.nameEn, p.descAr, p.descEn].join(" "));
const PRODUCT_SELECT = {
  id: true, storeId: true, groupId: true, nameAr: true, nameEn: true, descAr: true, descEn: true,
  priceMinor: true, oldPriceMinor: true, unit: true, unitAr: true, unitEn: true, available: true,
  featuredPosition: true, position: true, status: true, createdAt: true, updatedAt: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { id: true, key: true, width: true, height: true } },
} satisfies Prisma.ListingSelect;
export type Product = Prisma.ListingGetPayload<{ select: typeof PRODUCT_SELECT }>;

async function assertCatalogUser(s: Session) {
  if (s.role !== "PROVIDER" && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  if (s.role === "ADMIN") return;
  const u = await prisma.user.findUnique({ where: { id: s.sub }, select: { emailVerified: true } });
  if (!u) throw new ApiError("UNAUTHORIZED");
  if (!u.emailVerified) throw new ApiError("EMAIL_NOT_VERIFIED");
}

// ---------- sections ----------
export async function listSections(storeId: string, s: Session) {
  await ownStore(storeId, s);
  const rows = await prisma.listingGroup.findMany({ where: { storeId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { _count: { select: { listings: true } } } });
  return rows.map(({ _count, ...g }) => ({ ...g, productCount: _count.listings }));
}
export async function createSection(storeId: string, input: { nameAr: string; nameEn?: string }, s: Session) {
  await assertCatalogUser(s);
  await ownStore(storeId, s);
  const count = await prisma.listingGroup.count({ where: { storeId } });
  if (count >= MAX_SECTIONS) throw new ApiError("SECTION_LIMIT");
  const dup = await prisma.listingGroup.findFirst({ where: { storeId, nameAr: { equals: input.nameAr, mode: "insensitive" } } });
  if (dup) throw new ApiError("SECTION_EXISTS");
  return prisma.listingGroup.create({ data: { storeId, nameAr: input.nameAr, nameEn: input.nameEn || input.nameAr, position: count } });
}
async function ownSection(sectionId: string, s: Session) {
  const g = await prisma.listingGroup.findUnique({ where: { id: sectionId } });
  if (!g) throw new ApiError("NOT_FOUND");
  await ownStore(g.storeId, s);
  return g;
}
export async function renameSection(sectionId: string, input: { nameAr?: string; nameEn?: string }, s: Session) {
  const g = await ownSection(sectionId, s);
  const nameAr = input.nameAr ?? g.nameAr;
  if (input.nameAr && input.nameAr !== g.nameAr && (await prisma.listingGroup.findFirst({ where: { storeId: g.storeId, id: { not: g.id }, nameAr: { equals: nameAr, mode: "insensitive" } } })))
    throw new ApiError("SECTION_EXISTS");
  return prisma.listingGroup.update({ where: { id: g.id }, data: { nameAr, nameEn: input.nameEn || (input.nameAr ? input.nameAr : g.nameEn) } });
}
/** Deletes a section; its products move to "other" (groupId = null). Returns how many moved. */
export async function deleteSection(sectionId: string, s: Session) {
  const g = await ownSection(sectionId, s);
  const [moved] = await prisma.$transaction([
    prisma.listing.updateMany({ where: { groupId: g.id }, data: { groupId: null } }),
    prisma.listingGroup.delete({ where: { id: g.id } }),
  ]);
  return { moved: moved.count };
}
/** `ids` must be exactly the store's sections, in the new order. */
export async function reorderSections(storeId: string, ids: string[], s: Session) {
  await ownStore(storeId, s);
  const all = await prisma.listingGroup.findMany({ where: { storeId }, select: { id: true } });
  if (all.length !== ids.length || !all.every((g) => ids.includes(g.id))) throw new ApiError("VALIDATION", [{ field: "ids", message: "ids" }]);
  await prisma.$transaction(ids.map((id, i) => prisma.listingGroup.update({ where: { id }, data: { position: i } })));
  return listSections(storeId, s);
}

// ---------- products ----------
async function assertSection(sectionId: string | null | undefined, storeId: string) {
  if (!sectionId) return;
  const g = await prisma.listingGroup.findUnique({ where: { id: sectionId }, select: { storeId: true } });
  if (!g || g.storeId !== storeId) throw new ApiError("VALIDATION", [{ field: "sectionId", message: "section" }]);
}
async function ownProduct(id: string, s: Session) {
  const p = await prisma.listing.findUnique({ where: { id } });
  if (!p || !p.storeId) throw new ApiError("NOT_FOUND");
  if (s.role !== "ADMIN" && p.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
  return p as typeof p & { storeId: string };
}
/** Toggle featured: max 3 per store; only visible (APPROVED) products. */
async function setFeaturedFlag(p: { id: string; storeId: string; status: string; featuredPosition: number | null }, on: boolean) {
  if (on === (p.featuredPosition != null)) return;
  if (!on) {
    await prisma.listing.update({ where: { id: p.id }, data: { featuredPosition: null } });
    return compactFeatured(p.storeId);
  }
  if (p.status !== "APPROVED") throw new ApiError("NOT_APPROVED");
  const n = await prisma.listing.count({ where: { storeId: p.storeId, featuredPosition: { not: null } } });
  if (n >= MAX_FEATURED) throw new ApiError("FEATURED_LIMIT");
  await prisma.listing.update({ where: { id: p.id }, data: { featuredPosition: n + 1 } });
}

export async function listProducts(storeId: string, s: Session) {
  await ownStore(storeId, s);
  return prisma.listing.findMany({ where: { storeId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: PRODUCT_SELECT });
}
export const getProduct = async (id: string, s: Session) => {
  await ownProduct(id, s);
  return prisma.listing.findUniqueOrThrow({ where: { id }, select: PRODUCT_SELECT });
};

export async function createProduct(storeId: string, input: ProductInput, s: Session) {
  await assertCatalogUser(s);
  const store = await ownStore(storeId, s);
  if ((await prisma.listing.count({ where: { storeId } })) >= MAX_PRODUCTS) throw new ApiError("PRODUCT_LIMIT");
  await assertSection(input.sectionId, storeId);
  const data = { nameAr: input.nameAr, nameEn: input.nameEn || input.nameAr, descAr: input.descAr, descEn: input.descEn };
  const last = await prisma.listing.aggregate({ where: { storeId, groupId: input.sectionId ?? null }, _max: { position: true } });
  const p = await prisma.listing.create({
    data: {
      ...data, storeId, ownerId: store.ownerId, category: store.category, subcategory: store.subcategory,
      groupId: input.sectionId ?? null, phone: store.phone, whatsapp: store.whatsapp,
      priceType: "FIXED", priceMinor: input.price, oldPriceMinor: input.oldPrice ?? null, unit: input.unit,
      available: input.inStock, position: (last._max.position ?? -1) + 1,
      status: "APPROVED", searchText: search(data),
    },
    select: { id: true, storeId: true, status: true, featuredPosition: true },
  });
  if (input.featured) await setFeaturedFlag({ ...p, storeId }, true);
  return prisma.listing.findUniqueOrThrow({ where: { id: p.id }, select: PRODUCT_SELECT });
}

export async function updateProduct(id: string, input: Partial<ProductInput>, s: Session) {
  const cur = await ownProduct(id, s);
  if ("sectionId" in input) await assertSection(input.sectionId, cur.storeId);
  const price = input.price ?? cur.priceMinor;
  const old = input.oldPrice !== undefined ? input.oldPrice : cur.oldPriceMinor;
  if (price == null) throw new ApiError("VALIDATION", [{ field: "price", message: "price" }]);
  if (old != null && old <= price) throw new ApiError("VALIDATION", [{ field: "oldPrice", message: "oldPrice" }]);
  const merged = {
    nameAr: input.nameAr ?? cur.nameAr,
    nameEn: input.nameEn !== undefined ? input.nameEn || (input.nameAr ?? cur.nameAr) : cur.nameEn,
    descAr: input.descAr ?? cur.descAr, descEn: input.descEn ?? cur.descEn,
  };
  const data: Prisma.ListingUncheckedUpdateInput = {
    ...merged, priceType: "FIXED", priceMinor: price, oldPriceMinor: old ?? null, searchText: search(merged),
    ...(input.unit ? { unit: input.unit } : {}), ...(input.inStock !== undefined ? { available: input.inStock } : {}),
  };
  if ("sectionId" in input && (input.sectionId ?? null) !== cur.groupId) {
    const last = await prisma.listing.aggregate({ where: { storeId: cur.storeId, groupId: input.sectionId ?? null }, _max: { position: true } });
    data.groupId = input.sectionId ?? null;
    data.position = (last._max.position ?? -1) + 1;
  }
  await prisma.listing.update({ where: { id }, data });
  if (input.featured !== undefined) await setFeaturedFlag(cur, input.featured);
  return prisma.listing.findUniqueOrThrow({ where: { id }, select: PRODUCT_SELECT });
}

/** Quick edits from the product list: price / old price / in-stock / featured. */
export async function quickUpdateProduct(id: string, q: { price?: number; oldPrice?: number | null; inStock?: boolean; featured?: boolean }, s: Session) {
  return updateProduct(id, { ...(q.price !== undefined ? { price: q.price } : {}), ...(q.oldPrice !== undefined ? { oldPrice: q.oldPrice } : {}), ...(q.inStock !== undefined ? { inStock: q.inStock } : {}), ...(q.featured !== undefined ? { featured: q.featured } : {}) }, s);
}

/** Reorder products within one section (sectionId null = "other"). `ids` = all products of that section. */
export async function reorderProducts(storeId: string, sectionId: string | null, ids: string[], s: Session) {
  await ownStore(storeId, s);
  const all = await prisma.listing.findMany({ where: { storeId, groupId: sectionId }, select: { id: true } });
  if (all.length !== ids.length || !all.every((p) => ids.includes(p.id))) throw new ApiError("VALIDATION", [{ field: "ids", message: "ids" }]);
  await prisma.$transaction(ids.map((id, i) => prisma.listing.update({ where: { id }, data: { position: i } })));
  return listProducts(storeId, s);
}

export async function deleteProduct(id: string, s: Session) {
  await ownProduct(id, s);
  await deleteListing(id, s);
}

/** Public store page: store, ordered sections and all visible products (search/tabs are client-side). */
export async function storeCatalog(slug: string, viewer: Session | null) {
  const store = await prisma.store.findUnique({
    where: { slug }, omit: { searchText: true },
    include: { owner: OWNER_STATUS, video: true, groups: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
  });
  if (!store) throw new ApiError("NOT_FOUND");
  const canManage = !!viewer && (viewer.role === "ADMIN" || viewer.sub === store.ownerId);
  const pub = isStorePublic(store);
  if (!pub && !canManage) throw new ApiError("NOT_FOUND");
  const products = await prisma.listing.findMany({
    where: { storeId: store.id, status: "APPROVED" },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { ...PRODUCT_SELECT, priceType: true, currency: true },
  });
  const { owner: _o, video, groups, ...rest } = store;
  void _o;
  return {
    store: rest, sections: groups, products, public: pub, canManage,
    video: video && ((video.status === "APPROVED" && video.processing === "READY") || canManage) ? video : null,
  };
}
