import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as listStoresApi, POST as createStoreApi } from "@/app/api/stores/route";
import { PUT as putFeatured } from "@/app/api/stores/[id]/featured/route";
import { GET as bySlug } from "@/app/api/stores/by-slug/[slug]/route";
import { GET as listListingsApi, POST as createListingApi } from "@/app/api/listings/route";
import { PATCH as updateListingApi, DELETE as deleteListingApi } from "@/app/api/listings/[id]/route";
import { PATCH as listingStatus } from "@/app/api/admin/listings/[id]/status/route";
import { PATCH as storeStatus } from "@/app/api/admin/stores/[id]/status/route";
import { PATCH as videoStatus } from "@/app/api/admin/videos/[id]/status/route";
import { POST as uploadVideoApi } from "@/app/api/videos/route";
import { GET as activePromos, POST as requestPromo } from "@/app/api/promotions/route";
import { PATCH as adminPromo } from "@/app/api/admin/promotions/[id]/route";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/session";
import { runPendingVideoJobs, claimVideoJob } from "@/lib/services/videos";
import { storage, parseRange } from "@/lib/storage";
import { limiterBackend } from "@/lib/ratelimit";
import { GET as cronPromotions } from "@/app/api/cron/promotions/route";
import { GET as cronVideos } from "@/app/api/cron/videos/route";
import { POST as addImageApi } from "@/app/api/listings/[id]/images/route";
import sharp from "sharp";
import { formatMoney, formatPrice, toMinor } from "@/lib/price";
import { BASE, cookieOf, ctx, req, reset } from "./helpers";

const DAY = 86_400_000;
async function account(email: string, role = "PROVIDER", verified = true) {
  const r = await signup(req("/api/auth/signup", { method: "POST", body: { name: "User", email, password: "password123", role } }), {});
  if (verified) await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });
  return cookieOf(r);
}
async function adminCookie() {
  const u = await prisma.user.create({ data: { name: "Admin", email: `admin${Math.random()}@t.com`, password: "x", role: "ADMIN", emailVerified: new Date() } });
  return `nz_session=${await signSession({ sub: u.id, role: "ADMIN", name: u.name })}`;
}
const storeBody = { category: "groceries", nameAr: "متجر تجريبي", nameEn: "Test Store", phone: "01012345678" };
const priced = (o: Record<string, unknown> = {}) => ({ nameAr: "منتج", nameEn: "Product", priceType: "FIXED", priceMinor: 15000, ...o });
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

/** Provider with an APPROVED store. */
async function seller(email: string, body: Record<string, unknown> = storeBody) {
  const c = await account(email);
  const { body: b } = await json(await createStoreApi(req("/api/stores", { method: "POST", body, cookie: c }), {}));
  await prisma.store.update({ where: { id: b.store.id }, data: { status: "APPROVED" } });
  return { c, store: b.store as { id: string; slug: string } };
}
async function listing(c: string, o: Record<string, unknown> = {}, approve = true) {
  const { status, body } = await json(await createListingApi(req("/api/listings", { method: "POST", body: priced(o), cookie: c }), {}));
  expect(status).toBe(201);
  expect(body.listing.status).toBe("APPROVED"); // products publish immediately
  if (!approve) await prisma.listing.update({ where: { id: body.listing.id }, data: { status: "HIDDEN" } }); // hidden by admin
  return body.listing.id as string;
}

describe("provider onboarding", () => {
  beforeEach(reset);
  it("requires a section; medical requires a subcategory; one store per provider; PENDING", async () => {
    const c = await account("p@t.com");
    const noCat = await json(await createStoreApi(req("/api/stores", { method: "POST", body: { ...storeBody, category: undefined }, cookie: c, lang: "ar" }), {}));
    expect(noCat.status).toBe(422);
    expect(JSON.stringify(noCat.body.error.details)).toContain("اختر القسم");
    expect((await createStoreApi(req("/api/stores", { method: "POST", body: { ...storeBody, category: "medical" }, cookie: c }), {})).status).toBe(422);
    const ok = await json(await createStoreApi(req("/api/stores", { method: "POST", body: storeBody, cookie: c }), {}));
    expect(ok.status).toBe(201);
    expect(ok.body.store.status).toBe("PENDING");
    expect((await json(await createStoreApi(req("/api/stores", { method: "POST", body: storeBody, cookie: c }), {}))).body.error.code).toBe("STORE_EXISTS");
    // pending stores are not public
    expect((await json(await listStoresApi(req("/api/stores?category=groceries"), {}))).body.total).toBe(0);
  });
  it("rejects residents, unverified providers, and listings without a store", async () => {
    const r = await account("r@t.com", "RESIDENT");
    expect((await createStoreApi(req("/api/stores", { method: "POST", body: storeBody, cookie: r }), {})).status).toBe(403);
    const u = await account("u@t.com", "PROVIDER", false);
    expect((await json(await createStoreApi(req("/api/stores", { method: "POST", body: storeBody, cookie: u }), {}))).body.error.code).toBe("EMAIL_NOT_VERIFIED");
    const p = await account("p@t.com");
    expect((await json(await createListingApi(req("/api/listings", { method: "POST", body: priced(), cookie: p }), {}))).body.error.code).toBe("STORE_REQUIRED");
  });
});

describe("listing price", () => {
  beforeEach(reset);
  it("is required on create, validated, and ON_REQUEST clears amounts", async () => {
    const { c } = await seller("p@t.com");
    const missing = await json(await createListingApi(req("/api/listings", { method: "POST", body: { nameAr: "منتج", nameEn: "Product" }, cookie: c }), {}));
    expect(missing.status).toBe(422);
    expect((await createListingApi(req("/api/listings", { method: "POST", body: priced({ priceMinor: null }), cookie: c }), {})).status).toBe(422);
    expect((await createListingApi(req("/api/listings", { method: "POST", body: priced({ priceMinor: -5 }), cookie: c }), {})).status).toBe(422);
    const disc = await json(await createListingApi(req("/api/listings", { method: "POST", body: priced({ oldPriceMinor: 10000 }), cookie: c, lang: "en" }), {}));
    expect(disc.status).toBe(422);
    expect(disc.body.error.details.map((d: { field: string }) => d.field)).toContain("oldPriceMinor");
    expect((await createListingApi(req("/api/listings", { method: "POST", body: priced({ priceType: "ON_REQUEST", priceMinor: 500 }), cookie: c }), {})).status).toBe(422);
    const id = await listing(c, { priceType: "ON_REQUEST", priceMinor: null }, false);
    const l = await prisma.listing.findUniqueOrThrow({ where: { id } });
    expect([l.priceMinor, l.currency, l.category]).toEqual([null, "EGP", "groceries"]);
  });
  it("validates the merged price on update", async () => {
    const { c } = await seller("p@t.com");
    const id = await listing(c, { priceMinor: 20000, oldPriceMinor: 25000 });
    const bad = await updateListingApi(req("/x", { method: "PATCH", body: { priceMinor: 30000 }, cookie: c }), ctx(id));
    expect(bad.status).toBe(422);
    expect((await updateListingApi(req("/x", { method: "PATCH", body: { priceMinor: 24000 }, cookie: c }), ctx(id))).status).toBe(200);
    expect((await updateListingApi(req("/x", { method: "PATCH", body: { priceType: "ON_REQUEST" }, cookie: c }), ctx(id))).status).toBe(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id } })).priceMinor).toBeNull();
  });
  it("formats ar/en and parses Arabic digits", () => {
    expect(formatMoney(15000, "EGP", "ar")).toBe("١٥٠ ج.م");
    expect(formatMoney(15000, "EGP", "en")).toBe("EGP 150");
    expect(formatMoney(1250, "EGP", "en")).toBe("EGP 12.50");
    const f = formatPrice({ priceType: "FROM", priceMinor: 20000, oldPriceMinor: 25000, currency: "EGP", unitEn: "per kg" }, "en");
    expect(f.main).toContain("200");
    expect(f.discountPct).toBe(20);
    expect(formatPrice({ priceType: "ON_REQUEST", priceMinor: null, currency: "EGP" }, "en").hasAmount).toBe(false);
    expect(toMinor("١٥٠")).toBe(15000);
    expect(toMinor("12.5")).toBe(1250);
    expect(Number.isNaN(toMinor("abc"))).toBe(true);
  });
  it("sorts and filters by price in the API (major units)", async () => {
    const { c } = await seller("p@t.com");
    await listing(c, { nameEn: "Cheap", priceMinor: 1000 });
    await listing(c, { nameEn: "Mid", priceMinor: 5000 });
    await listing(c, { nameEn: "Dear", priceMinor: 90000 });
    await listing(c, { nameEn: "Ask", priceType: "ON_REQUEST", priceMinor: null });
    const asc = (await json(await listListingsApi(req("/api/listings?sort=price_asc"), {}))).body.items.map((x: { nameEn: string }) => x.nameEn);
    expect(asc).toEqual(["Cheap", "Mid", "Dear", "Ask"]);
    const desc = (await json(await listListingsApi(req("/api/listings?sort=price_desc"), {}))).body.items.map((x: { nameEn: string }) => x.nameEn);
    expect(desc.slice(0, 3)).toEqual(["Dear", "Mid", "Cheap"]);
    const range = (await json(await listListingsApi(req("/api/listings?minPrice=20&maxPrice=100"), {}))).body;
    expect(range.items.map((x: { nameEn: string; priceMinor: number }) => [x.nameEn, x.priceMinor])).toEqual([["Mid", 5000]]);
    expect((await listListingsApi(req("/api/listings?sort=cheap"), {})).status).toBe(422);
  });
});

describe("featured listings", () => {
  beforeEach(reset);
  it("max 3, ordered, own approved listings only; auto-unfeature on hide/delete", async () => {
    const { c, store } = await seller("p@t.com");
    const other = await seller("o@t.com");
    const ids = [await listing(c), await listing(c), await listing(c), await listing(c)];
    const pending = await listing(c, {}, false);
    const foreign = await listing(other.c);
    const put = (body: unknown, cookie = c) => putFeatured(req("/x", { method: "PUT", body, cookie }), ctx(store.id));
    expect((await put({ listingIds: ids })).status).toBe(422);
    expect((await json(await put({ listingIds: [foreign] }))).body.error.code).toBe("FORBIDDEN");
    expect((await json(await put({ listingIds: [pending] }))).body.error.code).toBe("NOT_APPROVED");
    expect((await put({ listingIds: [ids[0]] }, other.c)).status).toBe(403);
    const ok = await json(await put({ listingIds: [ids[2], ids[0], ids[1]] }));
    expect(ok.body.featured.map((f: { id: string }) => f.id)).toEqual([ids[2], ids[0], ids[1]]);

    const admin = await adminCookie();
    await listingStatus(req("/x", { method: "PATCH", body: { status: "HIDDEN" }, cookie: admin }), ctx(ids[2]));
    await deleteListingApi(req("/x", { method: "DELETE", cookie: c }), ctx(ids[0]));
    const left = await prisma.listing.findMany({ where: { storeId: store.id, featuredPosition: { not: null } }, orderBy: { featuredPosition: "asc" } });
    expect(left.map((l) => [l.id, l.featuredPosition])).toEqual([[ids[1], 1]]);
  });
});

describe("category stores & store page", () => {
  beforeEach(reset);
  it("lists public stores with up to 3 featured listings, sorted/filtered by price", async () => {
    const a = await seller("a@t.com", { ...storeBody, nameEn: "Alpha Store" });
    const b = await seller("b@t.com", { ...storeBody, nameEn: "Beta Store" });
    await seller("m@t.com", { ...storeBody, category: "medical", subcategory: "doctors", nameEn: "Clinic" });
    const a1 = await listing(a.c, { priceMinor: 50000 });
    const a2 = await listing(a.c, { priceMinor: 70000 });
    const b1 = await listing(b.c, { priceMinor: 2000 });
    await putFeatured(req("/x", { method: "PUT", body: { listingIds: [a2, a1] }, cookie: a.c }), ctx(a.store.id));
    await putFeatured(req("/x", { method: "PUT", body: { listingIds: [b1] }, cookie: b.c }), ctx(b.store.id));
    const res = (await json(await listStoresApi(req("/api/stores?category=groceries"), {}))).body;
    expect(res.total).toBe(2);
    const alpha = res.items.find((s: { nameEn: string }) => s.nameEn === "Alpha Store");
    expect(alpha.featured.map((l: { id: string }) => l.id)).toEqual([a2, a1]);
    expect(alpha.listingCount).toBe(2);
    expect(alpha.featured[0].priceMinor).toBe(70000);
    const asc = (await json(await listStoresApi(req("/api/stores?category=groceries&sort=price_asc"), {}))).body.items.map((s: { nameEn: string }) => s.nameEn);
    expect(asc).toEqual(["Beta Store", "Alpha Store"]);
    const desc = (await json(await listStoresApi(req("/api/stores?category=groceries&sort=price_desc"), {}))).body.items.map((s: { nameEn: string }) => s.nameEn);
    expect(desc).toEqual(["Alpha Store", "Beta Store"]);
    const ranged = (await json(await listStoresApi(req("/api/stores?category=groceries&minPrice=100"), {}))).body;
    expect(ranged.items.map((s: { nameEn: string }) => s.nameEn)).toEqual(["Alpha Store"]);
    // hidden stores disappear
    await prisma.store.update({ where: { id: a.store.id }, data: { status: "HIDDEN" } });
    expect((await json(await listStoresApi(req("/api/stores?category=groceries"), {}))).body.total).toBe(1);
  });
  it("store page returns header, featured, groups and approved listings only", async () => {
    const { c, store } = await seller("p@t.com");
    const g = await prisma.listingGroup.create({ data: { storeId: store.id, nameAr: "ألبان", nameEn: "Dairy" } });
    const l1 = await listing(c, { groupId: g.id, priceMinor: 3000 });
    await listing(c, { priceMinor: 1000 });
    await listing(c, {}, false);
    await putFeatured(req("/x", { method: "PUT", body: { listingIds: [l1] }, cookie: c }), ctx(store.id));
    const slugCtx = (q = "") => [req(`/api/stores/by-slug/${store.slug}${q}`), { params: Promise.resolve({ slug: store.slug }) }] as const;
    const d = (await json(await bySlug(...slugCtx()))).body;
    expect(d.store.nameEn).toBe("Test Store");
    expect(d.featured.map((x: { id: string }) => x.id)).toEqual([l1]);
    expect(d.listings.total).toBe(1); // featured l1 isn't repeated in "all listings"
    expect(d.listings.items.map((x: { id: string }) => x.id)).not.toContain(l1);
    expect(d.groups[0]).toMatchObject({ nameEn: "Dairy", count: 1 });
    const grp = (await json(await bySlug(...slugCtx(`?group=${g.id}`)))).body;
    expect(grp.listings.items.map((x: { id: string }) => x.id)).toEqual([l1]);
    const asc = (await json(await bySlug(...slugCtx("?sort=price_asc")))).body;
    expect(asc.listings.items.map((x: { priceMinor: number }) => x.priceMinor)).toEqual([1000]);
    const ranged = (await json(await bySlug(...slugCtx("?minPrice=0")))).body;
    expect(ranged.featured).toEqual([]);
    expect(ranged.listings.items.map((x: { priceMinor: number }) => x.priceMinor).sort()).toEqual([1000, 3000]);
    await prisma.store.update({ where: { id: store.id }, data: { status: "PENDING" } });
    expect((await bySlug(...slugCtx())).status).toBe(404);
  });
});

function videoReq(cookie: string, fields: Record<string, string>, data: Buffer | string, type: string, name: string) {
  const fd = new FormData();
  fd.set("file", new Blob([data], { type }), name);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(`${BASE}/api/videos`, { method: "POST", body: fd, headers: { cookie, "accept-language": "en" } });
}
function makeVideo(seconds: number) {
  const f = path.join(os.tmpdir(), `nz-test-${seconds}-${Date.now()}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc=size=320x240:rate=10:duration=${seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", f]);
  const b = fs.readFileSync(f);
  fs.rmSync(f);
  return b;
}

describe("promo video", () => {
  beforeEach(reset);
  it("validates real content, size and duration; transcodes; private until approved", async () => {
    const { c, store } = await seller("p@t.com");
    const fake = await json(await uploadVideoApi(videoReq(c, { storeId: store.id }, "not a video at all", "video/mp4", "x.mp4"), {}));
    expect(fake.body.error.code).toBe("VIDEO_INVALID");
    expect((await json(await uploadVideoApi(videoReq(c, { storeId: store.id }, "x", "text/plain", "x.txt"), {}))).body.error.code).toBe("VIDEO_INVALID");
    process.env.VIDEO_MAX_SECONDS = "2";
    try {
      expect((await json(await uploadVideoApi(videoReq(c, { storeId: store.id }, makeVideo(4), "video/mp4", "long.mp4"), {}))).body.error.code).toBe("VIDEO_TOO_LONG");
    } finally { delete process.env.VIDEO_MAX_SECONDS; }
    process.env.VIDEO_MAX_MB = "0.001";
    try {
      expect((await json(await uploadVideoApi(videoReq(c, { storeId: store.id }, makeVideo(1), "video/mp4", "big.mp4"), {}))).body.error.code).toBe("VIDEO_TOO_LARGE");
    } finally { delete process.env.VIDEO_MAX_MB; }
    const other = await seller("o@t.com");
    expect((await uploadVideoApi(videoReq(other.c, { storeId: store.id }, makeVideo(1), "video/mp4", "a.mp4"), {})).status).toBe(403);

    const ok = await json(await uploadVideoApi(videoReq(c, { storeId: store.id }, makeVideo(1), "video/mp4", "a.mp4"), {}));
    expect(ok.status).toBe(201);
    // Not transcoded in the request: queued for the worker.
    expect(ok.body.video).toMatchObject({ status: "PENDING", processing: "QUEUED", key: null });
    expect(ok.body.video.sourceKey).toMatch(/^incoming\//);
    expect(await prisma.videoJob.count({ where: { videoId: ok.body.video.id, status: "PENDING" } })).toBe(1);
    const page = async () => (await json(await bySlug(req(`/api/stores/by-slug/${store.slug}`), { params: Promise.resolve({ slug: store.slug }) }))).body;
    expect((await page()).video ?? null).toBeNull();
    const admin = await adminCookie();
    expect((await videoStatus(req("/x", { method: "PATCH", body: { status: "APPROVED" }, cookie: admin }), ctx(ok.body.video.id))).status).toBe(200);
    // approved but still processing: not public yet
    expect((await page()).video ?? null).toBeNull();
    const ran = await runPendingVideoJobs();
    expect(ran.map((r) => r.result)).toEqual(["DONE"]);
    const v = await prisma.video.findUniqueOrThrow({ where: { id: ok.body.video.id } });
    expect(v).toMatchObject({ processing: "READY", sourceKey: null });
    expect(v.key).toMatch(/^videos\/.+\.mp4$/);
    expect(v.posterKey).toMatch(/\.webp$/);
    expect(await storage.size(ok.body.video.sourceKey)).toBeNull();
    expect((await page()).video?.id).toBe(ok.body.video.id);
    expect(await prisma.auditLog.count({ where: { targetType: "VIDEO", targetId: ok.body.video.id } })).toBe(1);
  }, 60_000);
});

describe("promotions", () => {
  beforeEach(reset);
  it("request → approve → active (by priority) → expires by date", async () => {
    const { c, store } = await seller("p@t.com");
    const l = await listing(c, { priceMinor: 9900 });
    const now = Date.now();
    const body = { targetType: "LISTING", listingId: l, startsAt: new Date(now).toISOString(), endsAt: new Date(now + 3 * DAY).toISOString() };
    const r = await json(await requestPromo(req("/api/promotions", { method: "POST", body, cookie: c }), {}));
    expect(r.status).toBe(201);
    expect(r.body.promotion.status).toBe("APPROVED"); // published immediately, no admin approval
    const strip = async () => (await json(await activePromos(req("/api/promotions"), {}))).body.items;
    expect(await strip()).toHaveLength(1);

    const s2 = await json(await requestPromo(req("/api/promotions", { method: "POST", body: { targetType: "STORE", storeId: store.id, startsAt: body.startsAt, endsAt: body.endsAt }, cookie: c }), {}));
    const admin = await adminCookie();
    expect((await adminPromo(req("/x", { method: "PATCH", body: { status: "APPROVED", priority: 1 }, cookie: c }), ctx(r.body.promotion.id))).status).toBe(403);
    await adminPromo(req("/x", { method: "PATCH", body: { status: "APPROVED", priority: 1 }, cookie: admin }), ctx(r.body.promotion.id));
    await adminPromo(req("/x", { method: "PATCH", body: { status: "APPROVED", priority: 9 }, cookie: admin }), ctx(s2.body.promotion.id));
    const items = await strip();
    expect(items.map((i: { id: string }) => i.id)).toEqual([s2.body.promotion.id, r.body.promotion.id]);
    expect(items[1].price).toMatchObject({ priceMinor: 9900, currency: "EGP" });
    expect((await json(await activePromos(req("/api/promotions?category=clothing"), {}))).body.items).toHaveLength(0);

    await prisma.promotion.update({ where: { id: r.body.promotion.id }, data: { endsAt: new Date(now - 1000) } });
    expect(await strip()).toHaveLength(1);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: r.body.promotion.id } })).status).toBe("EXPIRED");
    expect((await json(await adminPromo(req("/x", { method: "PATCH", body: { status: "APPROVED" }, cookie: admin }), ctx(r.body.promotion.id)))).body.error.code).toBe("PROMOTION_ENDED");
    expect(await prisma.auditLog.count({ where: { targetType: "PROMOTION" } })).toBeGreaterThanOrEqual(2);
  });
  it("validates dates, ownership and pending limit; hidden listing drops from the strip", async () => {
    const { c } = await seller("p@t.com");
    const other = await seller("o@t.com");
    const l = await listing(c);
    const now = Date.now();
    const mk = (o: Record<string, unknown> = {}, cookie = c) => requestPromo(req("/api/promotions", { method: "POST", body: { targetType: "LISTING", listingId: l, startsAt: new Date(now).toISOString(), endsAt: new Date(now + DAY).toISOString(), ...o }, cookie }), {});
    expect((await json(await mk({ endsAt: new Date(now - DAY).toISOString() }))).body.error.code).toBe("INVALID_DATES");
    expect((await json(await mk({ endsAt: new Date(now + 60 * DAY).toISOString() }))).body.error.code).toBe("INVALID_DATES");
    expect((await mk({}, other.c)).status).toBe(403);
    const first = (await json(await mk())).body.promotion.id;
    await mk(); await mk();
    expect((await json(await mk())).body.error.code).toBe("PROMOTION_LIMIT");
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: first } })).status).toBe("APPROVED");
    expect((await json(await activePromos(req("/api/promotions"), {}))).body.items).toHaveLength(3);
    await prisma.listing.update({ where: { id: l }, data: { status: "HIDDEN" } });
    expect((await json(await activePromos(req("/api/promotions"), {}))).body.items).toHaveLength(0);
  });
});

describe("store moderation", () => {
  beforeEach(reset);
  it("only admins change store status, with an audit entry", async () => {
    const c = await account("p@t.com");
    const { body } = await json(await createStoreApi(req("/api/stores", { method: "POST", body: storeBody, cookie: c }), {}));
    expect((await storeStatus(req("/x", { method: "PATCH", body: { status: "APPROVED" }, cookie: c }), ctx(body.store.id))).status).toBe(403);
    const admin = await adminCookie();
    expect((await storeStatus(req("/x", { method: "PATCH", body: { status: "APPROVED" }, cookie: admin }), ctx(body.store.id))).status).toBe(200);
    expect((await json(await listStoresApi(req("/api/stores?category=groceries"), {}))).body.total).toBe(1);
    expect(await prisma.auditLog.findFirst({ where: { targetType: "STORE", targetId: body.store.id } })).toMatchObject({ action: expect.stringContaining("") });
  });
});

describe("video jobs", () => {
  beforeEach(reset);
  it("bad originals fail permanently; transient errors retry with backoff up to maxAttempts", async () => {
    const { c, store } = await seller("p@t.com");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "p@t.com" } });
    // A direct upload that isn't really a video (bypassed the multipart probe).
    const sourceKey = `incoming/${user.id}/video-abc.mp4`;
    await storage.put(sourceKey, Buffer.from("garbage"), "video/mp4");
    const up = await json(await uploadVideoApi(new Request(`${BASE}/api/videos`, { method: "POST", headers: { cookie: c, "content-type": "application/json" }, body: JSON.stringify({ sourceKey, storeId: store.id }) }), {}));
    expect(up.status).toBe(201);
    expect((await runPendingVideoJobs()).map((r) => r.result)).toEqual(["FAILED"]);
    expect(await prisma.video.findUniqueOrThrow({ where: { id: up.body.video.id } })).toMatchObject({ processing: "FAILED", error: "VIDEO_INVALID" });
    expect(await storage.size(sourceKey)).toBeNull();

    // Transient error (e.g. storage outage) -> RETRY with backoff, then FAILED after maxAttempts.
    await storage.put(sourceKey, Buffer.from("x"), "video/mp4");
    await prisma.video.update({ where: { id: up.body.video.id }, data: { processing: "QUEUED", error: null, sourceKey, jobs: { create: { maxAttempts: 2 } } } });
    const spy = vi.spyOn(storage, "get").mockRejectedValue(new Error("network down"));
    try {
      expect((await runPendingVideoJobs()).map((r) => r.result)).toEqual(["RETRY"]);
      const job = await prisma.videoJob.findFirstOrThrow({ where: { videoId: up.body.video.id, maxAttempts: 2 } });
      expect(job).toMatchObject({ status: "PENDING", attempts: 1 });
      expect(job.runAfter.getTime()).toBeGreaterThan(Date.now());
      expect(await runPendingVideoJobs()).toEqual([]); // not due yet
      await prisma.videoJob.update({ where: { id: job.id }, data: { runAfter: new Date() } });
      expect((await runPendingVideoJobs()).map((r) => r.result)).toEqual(["FAILED"]);
      expect((await prisma.videoJob.findUniqueOrThrow({ where: { id: job.id } })).lastError).toContain("network down");
    } finally { spy.mockRestore(); }
  }, 60_000);
  it("claims each job once (row lock) and recovers stale locks", async () => {
    const { store } = await seller("p@t.com");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "p@t.com" } });
    const v = await prisma.video.create({ data: { storeId: store.id, ownerId: user.id, sourceKey: `incoming/${user.id}/x.mp4`, jobs: { create: {} } } });
    const [a, b] = await Promise.all([claimVideoJob(), claimVideoJob()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await claimVideoJob()).toBeNull();
    await prisma.videoJob.updateMany({ where: { videoId: v.id }, data: { lockedAt: new Date(Date.now() - 20 * 60_000) } });
    const again = await claimVideoJob();
    expect(again?.attempts).toBe(2);
  });
});

describe("direct uploads, cron and infra", () => {
  beforeEach(reset);
  it("accepts a direct-upload sourceKey only from the caller's own incoming/ folder", async () => {
    const { c } = await seller("p@t.com");
    const other = await seller("o@t.com");
    const me = await prisma.user.findUniqueOrThrow({ where: { email: "p@t.com" } });
    const them = await prisma.user.findUniqueOrThrow({ where: { email: "o@t.com" } });
    const id = await listing(c);
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c00" } }).png().toBuffer();
    const post = (sourceKey: string, cookie = c) => addImageApi(new Request(`${BASE}/api/listings/${id}/images`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ sourceKey }) }), ctx(id));
    await storage.put(`incoming/${them.id}/image-1.png`, png, "image/png");
    expect((await post(`incoming/${them.id}/image-1.png`)).status).toBe(403);
    expect((await post(`listings/../etc/passwd`)).status).toBe(422);
    await storage.put(`incoming/${me.id}/image-2.png`, png, "image/png");
    const ok = await json(await post(`incoming/${me.id}/image-2.png`));
    expect(ok.status).toBe(201);
    expect(ok.body.image.key).toMatch(/^listings\/.+\.webp$/);
    expect(await storage.size(`incoming/${me.id}/image-2.png`)).toBeNull(); // original removed
    // incoming/ originals are never served
    const { GET: serve } = await import("@/app/api/uploads/[...key]/route");
    expect((await serve(req(`/api/uploads/incoming/${them.id}/image-1.png`, { cookie: other.c }), { params: Promise.resolve({ key: ["incoming", them.id, "image-1.png"] }) })).status).toBe(404);
  });
  it("cron routes require CRON_SECRET and expire promotions", async () => {
    const { c, store } = await seller("p@t.com");
    void c;
    const p = await prisma.promotion.create({ data: { targetType: "STORE", storeId: store.id, category: "groceries", startsAt: new Date(Date.now() - 2 * DAY), endsAt: new Date(Date.now() - 1000), status: "APPROVED" } });
    const call = (auth?: string) => cronPromotions(new Request(`${BASE}/api/cron/promotions`, { headers: auth ? { authorization: auth } : {} }), {});
    delete process.env.CRON_SECRET;
    expect((await call("Bearer x")).status).toBe(404);
    process.env.CRON_SECRET = "s3cret-value";
    try {
      expect((await call()).status).toBe(401);
      expect((await call("Bearer wrong-value")).status).toBe(401);
      const r = await json(await call("Bearer s3cret-value"));
      expect(r.body.expired).toBe(1);
      expect((await prisma.promotion.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("EXPIRED");
      expect((await json(await cronVideos(new Request(`${BASE}/api/cron/videos`, { headers: { authorization: "Bearer s3cret-value" } }), {}))).body.processed).toEqual([]);
    } finally { delete process.env.CRON_SECRET; }
  });
  it("range parsing and limiter backend selection", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=95-", 100)).toEqual({ start: 95, end: 99 });
    expect(parseRange("bytes=200-", 100)).toBe("416");
    expect(parseRange(null, 100)).toBeNull();
    expect(limiterBackend({} as unknown as NodeJS.ProcessEnv)).toBe("memory");
    expect(limiterBackend({ REDIS_URL: "redis://x" } as unknown as NodeJS.ProcessEnv)).toBe("redis");
    expect(limiterBackend({ UPSTASH_REDIS_REST_URL: "https://x", UPSTASH_REDIS_REST_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)).toBe("upstash");
    expect(limiterBackend({ KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "t", REDIS_URL: "redis://x" } as unknown as NodeJS.ProcessEnv)).toBe("upstash");
  });
});
