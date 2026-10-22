import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/session";
import { ApiError } from "@/lib/errors";
import { productCreateSchema, productQuickSchema, toEgE164, storeUpdateSchema } from "@/lib/validation";
import * as cat from "@/lib/services/catalog";
import { setListingStatus } from "@/lib/services/listings";
import { POST as createProductApi } from "@/app/api/stores/[id]/products/route";
import { PATCH as quickApi } from "@/app/api/products/[id]/quick/route";
import { signSession } from "@/lib/session";
import { reset, req, ctx } from "./helpers";

async function provider(email: string, verified = true) {
  const u = await prisma.user.create({ data: { email, name: "P", password: "x", role: "PROVIDER", emailVerified: verified ? new Date() : null } });
  const store = await prisma.store.create({ data: { slug: email.replace(/\W/g, ""), ownerId: u.id, category: "groceries", nameAr: "بقالة", nameEn: "Grocery", phone: "01012345678", status: "APPROVED" } });
  const s: Session = { sub: u.id, role: "PROVIDER", name: "P", sv: 0 };
  return { u, store, s };
}
const admin = async (): Promise<Session> => {
  const u = await prisma.user.create({ data: { email: "admin@t.com", name: "A", password: "x", role: "ADMIN", emailVerified: new Date() } });
  return { sub: u.id, role: "ADMIN", name: "A", sv: 0 };
};
const code = async (p: Promise<unknown>) => { try { await p; return "OK"; } catch (e) { return e instanceof ApiError ? e.code : String(e); } };
const prod = (o: Record<string, unknown> = {}) => productCreateSchema.parse({ nameAr: "لبن", price: "35.5", unit: "liter", ...o });

describe("catalog validation", () => {
  it("price is required, converted to piasters, max 2 decimals; old price must be higher", () => {
    expect(prod().price).toBe(3550);
    expect(productCreateSchema.safeParse({ nameAr: "x" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ nameAr: "x", price: 0 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ nameAr: "x", price: 1.234 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ nameAr: "x", price: 10, oldPrice: 9 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ nameAr: "x", price: 10, unit: "ton" }).success).toBe(false);
    expect(productQuickSchema.safeParse({}).success).toBe(false);
  });
  it("normalizes Egyptian WhatsApp numbers to E.164", () => {
    expect(toEgE164("01012345678")).toBe("+201012345678");
    expect(toEgE164("+20 115 123 4567")).toBe("+201151234567");
    expect(toEgE164("٠١٢٣٤٥٦٧٨٩٠")).toBe("+201234567890");
    expect(toEgE164("0123")).toBeNull();
    expect(toEgE164("01312345678")).toBeNull();
    expect(storeUpdateSchema.parse({ whatsapp: "00201012345678" }).whatsapp).toBe("+201012345678");
    expect(storeUpdateSchema.safeParse({ whatsapp: "12345" }).success).toBe(false);
    expect(storeUpdateSchema.safeParse({ openTime: "25:00" }).success).toBe(false);
  });
});

describe("sections", () => {
  beforeEach(reset);
  it("create (unique, nameEn falls back to Arabic), rename, reorder, delete moves products to other", async () => {
    const { store, s } = await provider("p@t.com");
    const a = await cat.createSection(store.id, { nameAr: "ألبان" }, s);
    expect(a.nameEn).toBe("ألبان");
    const b = await cat.createSection(store.id, { nameAr: "بيض", nameEn: "Eggs" }, s);
    expect(await code(cat.createSection(store.id, { nameAr: "ألبان" }, s))).toBe("SECTION_EXISTS");
    await cat.renameSection(a.id, { nameAr: "ألبان وأجبان", nameEn: "Dairy" }, s);
    const ordered = await cat.reorderSections(store.id, [b.id, a.id], s);
    expect(ordered.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(await code(cat.reorderSections(store.id, [b.id], s))).toBe("VALIDATION");
    const p = await cat.createProduct(store.id, prod({ sectionId: a.id }), s);
    expect(await cat.deleteSection(a.id, s)).toEqual({ moved: 1 });
    expect((await prisma.listing.findUnique({ where: { id: p.id } }))!.groupId).toBeNull();
  });
  it("enforces ownership", async () => {
    const one = await provider("a@t.com");
    const two = await provider("b@t.com");
    const g = await cat.createSection(one.store.id, { nameAr: "ألبان" }, one.s);
    expect(await code(cat.createSection(one.store.id, { nameAr: "x" }, two.s))).toBe("FORBIDDEN");
    expect(await code(cat.renameSection(g.id, { nameAr: "x" }, two.s))).toBe("FORBIDDEN");
    expect(await code(cat.deleteSection(g.id, two.s))).toBe("FORBIDDEN");
    expect(await code(cat.listSections(one.store.id, two.s))).toBe("FORBIDDEN");
  });
});

describe("products", () => {
  beforeEach(reset);
  it("publish immediately with price+unit; quick edits; featured max 3; reorder; admin hide is audited", async () => {
    const { store, s } = await provider("p@t.com");
    const g = await cat.createSection(store.id, { nameAr: "ألبان" }, s);
    const p = await cat.createProduct(store.id, prod({ sectionId: g.id, oldPrice: 40 }), s);
    expect(p).toMatchObject({ status: "APPROVED", priceMinor: 3550, oldPriceMinor: 4000, unit: "liter", available: true, nameEn: "لبن", groupId: g.id, position: 0 });
    const q = await cat.quickUpdateProduct(p.id, { price: 3000, inStock: false }, s);
    expect(q).toMatchObject({ priceMinor: 3000, available: false });
    expect(await code(cat.quickUpdateProduct(p.id, { price: 5000 }, s))).toBe("VALIDATION"); // old price 40 <= 50
    const ids = [p.id];
    for (let i = 0; i < 3; i++) ids.push((await cat.createProduct(store.id, prod({ sectionId: g.id, nameAr: `منتج ${i}` }), s)).id);
    for (const id of ids.slice(0, 3)) await cat.quickUpdateProduct(id, { featured: true }, s);
    expect(await code(cat.quickUpdateProduct(ids[3], { featured: true }, s))).toBe("FEATURED_LIMIT");
    await cat.quickUpdateProduct(ids[0], { featured: false }, s);
    const fp = await prisma.listing.findMany({ where: { storeId: store.id, featuredPosition: { not: null } }, orderBy: { featuredPosition: "asc" } });
    expect(fp.map((x) => [x.id, x.featuredPosition])).toEqual([[ids[1], 1], [ids[2], 2]]);
    const re = await cat.reorderProducts(store.id, g.id, [...ids].reverse(), s);
    expect(re.map((x) => x.id)).toEqual([...ids].reverse());
    // moving to "other"
    const moved = await cat.updateProduct(ids[3], { sectionId: null }, s);
    expect(moved.groupId).toBeNull();
    // admin hide/unhide → audit
    const a = await admin();
    await setListingStatus(ids[1], "HIDDEN", a);
    expect((await prisma.auditLog.findMany()).map((l) => l.action)).toContain("LISTING_STATUS_CHANGED");
    expect(await code(cat.quickUpdateProduct(ids[1], { featured: true }, s))).toBe("NOT_APPROVED");
  });
  it("ownership, section of another store, unverified provider", async () => {
    const one = await provider("a@t.com");
    const two = await provider("b@t.com");
    const p = await cat.createProduct(one.store.id, prod(), one.s);
    const g2 = await cat.createSection(two.store.id, { nameAr: "قسم" }, two.s);
    expect(await code(cat.createProduct(one.store.id, prod(), two.s))).toBe("FORBIDDEN");
    expect(await code(cat.updateProduct(p.id, { price: 100 }, two.s))).toBe("FORBIDDEN");
    expect(await code(cat.deleteProduct(p.id, two.s))).toBe("FORBIDDEN");
    expect(await code(cat.createProduct(one.store.id, prod({ sectionId: g2.id }), one.s))).toBe("VALIDATION");
    expect(await code(cat.reorderProducts(one.store.id, null, [p.id], two.s))).toBe("FORBIDDEN");
    const un = await provider("u@t.com", false);
    expect(await code(cat.createProduct(un.store.id, prod(), un.s))).toBe("EMAIL_NOT_VERIFIED");
    await cat.deleteProduct(p.id, one.s);
    expect(await prisma.listing.count({ where: { id: p.id } })).toBe(0);
  });
  it("HTTP: create + quick edit with bilingual validation errors", async () => {
    const { store, u } = await provider("p@t.com");
    const cookie = `nz_session=${await signSession({ sub: u.id, role: "PROVIDER", name: "P" })}`;
    const bad = await createProductApi(req(`/x?lang=en`, { method: "POST", body: { nameAr: "x" }, cookie }), ctx(store.id));
    expect(bad.status).toBe(422);
    const ok = await createProductApi(req(`/x`, { method: "POST", body: { nameAr: "أرز", price: 40, unit: "kg" }, cookie }), ctx(store.id));
    expect(ok.status).toBe(201);
    const { product } = await ok.json();
    const q = await quickApi(req(`/x`, { method: "PATCH", body: { inStock: false }, cookie }), ctx(product.id));
    expect((await q.json()).product.available).toBe(false);
    const anon = await quickApi(req(`/x`, { method: "PATCH", body: { inStock: true } }), ctx(product.id));
    expect(anon.status).toBe(401);
  });
});

import { isOpenAt, waOrderLink } from "@/lib/store-hours";
import { formatPrice } from "@/lib/price";
describe("store helpers", () => {
  it("open/closed incl. after-midnight hours", () => {
    expect(isOpenAt(null, "10:00", 600)).toBeNull();
    expect(isOpenAt("09:00", "22:00", 9 * 60)).toBe(true);
    expect(isOpenAt("09:00", "22:00", 22 * 60)).toBe(false);
    expect(isOpenAt("18:00", "02:00", 60)).toBe(true);
    expect(isOpenAt("18:00", "02:00", 12 * 60)).toBe(false);
  });
  it("WhatsApp order link and unit labels", () => {
    expect(waOrderLink("+201012345678", "أهلاً")).toBe("https://wa.me/201012345678?text=%D8%A3%D9%87%D9%84%D8%A7%D9%8B");
    expect(waOrderLink("01012345678", "x")).toBe("https://wa.me/201012345678?text=x");
    expect(formatPrice({ priceType: "FIXED", priceMinor: 3550, currency: "EGP", unit: "kg" }, "en").main).toBe("EGP 35.50 / kg");
  });
});

import { createDemoStore, removeDemoStore, DEMO_SLUG, DEMO_EMAIL } from "@/lib/services/demo";
describe("demo store", () => {
  beforeEach(reset);
  it("creates once (approved, flagged demo, 7 sections, priced) and removes everything", async () => {
    const a = await admin();
    const r = await createDemoStore(a);
    expect(r.created).toBe(true);
    expect((await createDemoStore(a)).created).toBe(false);
    const st = await prisma.store.findUniqueOrThrow({ where: { slug: DEMO_SLUG } });
    expect(st).toMatchObject({ status: "APPROVED", isExample: true, category: "groceries" });
    expect(await prisma.listingGroup.count({ where: { storeId: st.id } })).toBe(7);
    const items = await prisma.listing.findMany({ where: { storeId: st.id } });
    expect(items.length).toBeGreaterThanOrEqual(21);
    expect(items.every((i) => i.priceMinor! > 0 && i.unit && i.isExample && i.status === "APPROVED")).toBe(true);
    expect(items.filter((i) => i.featuredPosition != null)).toHaveLength(3);
    await removeDemoStore(a);
    expect(await prisma.store.count({ where: { slug: DEMO_SLUG } })).toBe(0);
    expect(await prisma.user.count({ where: { email: DEMO_EMAIL } })).toBe(0);
    expect(await prisma.listing.count({ where: { storeId: st.id } })).toBe(0);
  });
});
