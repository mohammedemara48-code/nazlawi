import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/session";
import { ApiError } from "@/lib/errors";
import * as cat from "@/lib/services/catalog";
import * as trash from "@/lib/services/trash";
import { createStore, storeCounts, storePage } from "@/lib/services/stores";
import { getListing, listPublic } from "@/lib/services/listings";
import { activePromotions } from "@/lib/services/promotions";
import { productCreateSchema, profileSchema, storeCreateSchema } from "@/lib/validation";
import { reset, req } from "./helpers";
import { signSession } from "@/lib/session";
import { POST as createStoreApi } from "@/app/api/stores/route";

const code = async (p: Promise<unknown>) => { try { await p; return "OK"; } catch (e) { return e instanceof ApiError ? e.code : String(e); } };
async function setup() {
  const u = await prisma.user.create({ data: { email: "p@t.com", name: "P", password: "x", role: "PROVIDER", emailVerified: new Date() } });
  const store = await prisma.store.create({ data: { slug: "shop", ownerId: u.id, category: "groceries", nameAr: "بقالة", nameEn: "Grocery", phone: "01012345678", status: "APPROVED" } });
  const s: Session = { sub: u.id, role: "PROVIDER", name: "P", sv: 0 };
  const a = await prisma.user.create({ data: { email: "admin@t.com", name: "A", password: "x", role: "ADMIN", emailVerified: new Date() } });
  const admin: Session = { sub: a.id, role: "ADMIN", name: "A", sv: 0 };
  const p = await cat.createProduct(store.id, productCreateSchema.parse({ nameAr: "لبن", price: 10, featured: true }), s);
  return { u, store, s, admin, p };
}
const q = { page: 1, pageSize: 20, sort: "newest" as const };

describe("admins can't own stores", () => {
  beforeEach(reset);
  it("createStore returns ADMIN_NO_STORE (403) for admins", async () => {
    const { admin } = await setup();
    const input = storeCreateSchema.parse({ nameAr: "متجر", nameEn: "Shop", category: "groceries", phone: "01012345678" });
    const e = await createStore(input, admin).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe("ADMIN_NO_STORE");
    const cookie = `nz_session=${await signSession({ sub: admin.sub, role: "ADMIN", name: "A" })}`;
    const res = await createStoreApi(req("/api/stores", { method: "POST", cookie, body: { nameAr: "متجر", nameEn: "Shop", category: "groceries", phone: "01012345678" } }), undefined as never);
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toContain("الإدارة");
    const resEn = await createStoreApi(req("/api/stores", { method: "POST", cookie, lang: "en", body: { nameAr: "متجر", nameEn: "Shop", category: "groceries", phone: "01012345678" } }), undefined as never);
    expect((await resEn.json()).error.message).toContain("Admin accounts");
  });
  it("adminOwnedStores flags stores owned by admin accounts", async () => {
    const { admin } = await setup();
    await prisma.store.create({ data: { slug: "adm", ownerId: admin.sub, category: "groceries", nameAr: "أ", nameEn: "A", phone: "01012345678", status: "APPROVED" } });
    expect((await trash.adminOwnedStores()).map((x) => x.slug)).toEqual(["adm"]);
  });
});

describe("admin soft delete", () => {
  beforeEach(reset);
  it("deleted store disappears everywhere (page, category, counts, products, promotions) even for the admin, and can be restored", async () => {
    const { store, admin, p, s } = await setup();
    await prisma.promotion.create({ data: { targetType: "LISTING", storeId: store.id, listingId: p.id, category: "groceries", status: "APPROVED", startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86400_000) } });
    expect((await listPublic({ ...q })).total).toBe(1);
    expect(await code(trash.softDeleteStore(store.id, s))).toBe("FORBIDDEN");
    await trash.softDeleteStore(store.id, admin);
    expect(await code(storePage("shop", admin, q))).toBe("NOT_FOUND");
    expect(await code(cat.storeCatalog("shop", admin))).toBe("NOT_FOUND");
    expect(await code(getListing(p.id, null))).toBe("NOT_FOUND");
    expect((await listPublic({ ...q })).total).toBe(0);
    expect((await storeCounts()).groceries ?? 0).toBe(0);
    expect((await activePromotions({ category: "groceries" })).length).toBe(0);
    expect(await code(cat.listProducts(store.id, s))).toBe("NOT_FOUND"); // owner can't edit a deleted store
    expect((await trash.adminTrash()).stores).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: "STORE_DELETED" } })).toBe(1);
    await trash.restoreStore(store.id, admin);
    expect((await listPublic({ ...q })).total).toBe(1);
  });
  it("deleted product disappears from store page, search and product page; purge after 30 days", async () => {
    const { store, admin, p } = await setup();
    await trash.softDeleteListing(p.id, admin);
    const page = await cat.storeCatalog("shop", null);
    expect(page.products).toHaveLength(0);
    expect((await storePage("shop", null, q)).featured).toHaveLength(0);
    expect((await listPublic({ ...q, q: "لبن" } as never)).total).toBe(0);
    expect(await code(getListing(p.id, admin))).toBe("NOT_FOUND");
    expect(await prisma.auditLog.count({ where: { action: "LISTING_DELETED" } })).toBe(1);
    expect(await trash.purgeExpiredTrash()).toEqual({ stores: 0, listings: 0 }); // still in the grace period
    expect(await trash.purgeExpiredTrash(Date.now() + 31 * 86400_000)).toEqual({ stores: 0, listings: 1 });
    expect(await prisma.listing.count()).toBe(0);
    expect(await prisma.store.count({ where: { id: store.id } })).toBe(1);
  });
  it("hard delete removes the store and its products immediately", async () => {
    const { store, admin } = await setup();
    await trash.purgeStore(store.id, admin);
    expect(await prisma.store.count()).toBe(0);
    expect(await prisma.listing.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "STORE_PURGED" } })).toBe(1);
  });
});

describe("map pin validation", () => {
  it("lat/lng both or neither, within range; landmark optional", () => {
    expect(profileSchema.safeParse({ latitude: 30.1, longitude: 31.2, addressNote: "جنب الجامع" }).success).toBe(true);
    expect(profileSchema.safeParse({ latitude: 30.1 }).success).toBe(false);
    expect(profileSchema.safeParse({ latitude: 95, longitude: 31 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ nameAr: "لبن", price: 1, latitude: 30, longitude: 31, locationNote: "x" }).success).toBe(true);
    expect(productCreateSchema.safeParse({ nameAr: "لبن", price: 1, longitude: 31 }).success).toBe(false);
  });
});
