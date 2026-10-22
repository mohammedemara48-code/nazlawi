#!/usr/bin/env node
/**
 * Pre-deploy smoke suite (Playwright, mobile 390px, real browser against a production build).
 *   npm run smoke            # builds into .next-smoke, starts it on a free port, seeds fixtures in the LOCAL db, runs checks
 *   SMOKE_SKIP_BUILD=1 npm run smoke   # reuse the last smoke build
 * Fixtures are created with the "smoke-" prefix and removed at the end. Never point this at production.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

if (/vercel|neon|supabase|amazonaws/.test(process.env.DATABASE_URL ?? "")) { console.error("Refusing to run smoke fixtures against a remote database."); process.exit(2); }
const PORT = Number(process.env.SMOKE_PORT || 3197);
const BASE = `http://localhost:${PORT}`;
const env = { ...process.env, NEXT_DIST_DIR: ".next-smoke", NEXT_TELEMETRY_DISABLED: "1" };
const prisma = new PrismaClient();
const PASS = "Smoke-Pass-12345";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e instanceof Error ? e.message.split("\n")[0] : String(e)]); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

async function seed() {
  await cleanup();
  const hash = await bcrypt.hash(PASS, 10);
  const mk = async (tag, status, verified = true) => {
    const u = await prisma.user.create({ data: { email: `smoke-${tag}@nazlawi.test`, name: `Smoke ${tag}`, role: "PROVIDER", password: hash, emailVerified: verified ? new Date() : null } });
    const store = await prisma.store.create({ data: { slug: `smoke-${tag}`, ownerId: u.id, category: "groceries", nameAr: `متجر ${tag}`, nameEn: `Smoke ${tag}`, phone: "01012345678", whatsapp: "+201012345678", status } });
    const g = await prisma.listingGroup.create({ data: { storeId: store.id, nameAr: "ألبان", nameEn: "Dairy" } });
    await prisma.listing.create({ data: { storeId: store.id, ownerId: u.id, groupId: g.id, category: "groceries", nameAr: "لبن سموك", nameEn: "Smoke milk", phone: "01012345678", priceType: "FIXED", priceMinor: 3800, unit: "liter", status: "APPROVED", featuredPosition: 1 } });
    return { u, store };
  };
  const approved = await mk("approved", "APPROVED");
  await prisma.store.update({ where: { id: approved.store.id }, data: { latitude: 30.0444, longitude: 31.2357, addressAr: "جنب الجامع الكبير" } });
  const todelete = await mk("todelete", "APPROVED");
  const admin = await prisma.user.create({ data: { email: "smoke-admin@nazlawi.test", name: "Smoke admin", role: "ADMIN", password: hash, emailVerified: new Date() } });
  await prisma.store.create({ data: { slug: "smoke-adminstore", ownerId: admin.id, category: "groceries", nameAr: "متجر الأدمن", nameEn: "Admin store", phone: "01012345678", status: "APPROVED" } });
  return { approved, todelete, admin, pending: await mk("pending", "PENDING"), unverified: await mk("unverified", "PENDING", false) };
}
async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: "smoke-" } } });
}

async function waitUp() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + "/api/health"); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error("server did not start");
}

async function main() {
  if (!process.env.SMOKE_SKIP_BUILD) {
    const nextEnv = readFileSync("next-env.d.ts", "utf8"); // next build rewrites it to point at .next-smoke; keep typecheck on .next
    const b = spawnSync("npx", ["next", "build"], { env, stdio: "inherit" });
    writeFileSync("next-env.d.ts", nextEnv);
    if (b.status !== 0) process.exit(b.status ?? 1);
  }
  const fx = await seed();
  // Dynamic pages stream behind loading.tsx, so a 404 may arrive as 200 + the not-found UI.
  const notFoundPage = async (page, path) => {
    const r = await page.goto(BASE + path, { waitUntil: "networkidle" });
    assert(r.status() === 404 || (await page.getByText("الصفحة غير موجودة").count()) > 0, `${path} still visible (status ${r.status()})`);
  };
  const shot = async (page, name) => { if (process.env.SMOKE_SCREENSHOTS) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS}/${name}.png`, fullPage: true }); };
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  let code = 1;
  try {
    await waitUp();
    const browser = await chromium.launch();
    const newPage = async (login) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar-EG" });
      const page = await ctx.newPage();
      if (login) { const r = await page.request.post(BASE + "/api/auth/login", { data: { email: login, password: PASS } }); assert(r.ok(), `login ${login} → ${r.status()}`); }
      return page;
    };
    for (const kind of ["pending", "approved", "unverified"]) {
      const page = await newPage(`smoke-${kind}@nazlawi.test`);
      await check(`store-info tab (${kind} store): logo/cover/video upload controls`, async () => {
        const res = await page.goto(BASE + "/dashboard?tab=info", { waitUntil: "networkidle" });
        assert(res.ok(), `status ${res.status()}`);
        for (const id of ["upload-logo", "upload-cover", "upload-video"]) {
          const box = page.getByTestId(id);
          assert(await box.isVisible(), `${id} not visible`);
          assert((await box.locator('input[type="file"]').count()) >= 1, `${id} has no file input`);
        }
        assert(await page.locator('input[name="nameAr"]').isVisible(), "store form missing");
        assert(await page.getByText("الموقع على الخريطة").isVisible(), "map picker missing");
        if (process.env.SMOKE_SCREENSHOTS) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS}/fix-store-info-${kind}.png` });
      });
      await check(`dashboard (${kind}): edit-store link + products tab`, async () => {
        await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
        assert(await page.getByTestId("edit-store-link").isVisible(), "edit store link missing");
        assert(await page.getByText("لبن سموك").first().isVisible(), "product row missing");
        assert(await page.getByRole("button", { name: /إضافة منتج/ }).last().isVisible(), "add-product button missing");
      });
      await check(`/dashboard/store redirects to store info (${kind})`, async () => {
        await page.goto(BASE + "/dashboard/store", { waitUntil: "networkidle" });
        assert(page.url().includes("tab=info"), `landed on ${page.url()}`);
        assert(await page.getByTestId("upload-logo").isVisible(), "logo upload missing after redirect");
      });
      await check(`promote tab (${kind}): promotion form visible`, async () => {
        await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
        assert(await page.getByRole("tab", { name: "الترويج" }).isVisible(), "promote tab missing from nav");
        await page.goto(BASE + "/dashboard?tab=promote", { waitUntil: "networkidle" });
        const tab = page.getByTestId("promote-tab");
        assert(await tab.isVisible(), "promote tab content missing");
        assert(await tab.locator('select[name="target"]').isVisible(), "promotion target select missing");
        assert(await tab.locator('input[name="startsAt"]').isVisible(), "promotion dates missing");
      });
      await check(`sections tab (${kind})`, async () => {
        await page.goto(BASE + "/dashboard?tab=sections", { waitUntil: "networkidle" });
        assert(await page.getByText("ألبان").first().isVisible(), "section missing");
      });
      await page.context().close();
    }
    const anon = await newPage();
    await check("public store page (approved) shows products + WhatsApp order", async () => {
      const r = await anon.goto(BASE + "/s/smoke-approved", { waitUntil: "networkidle" });
      assert(r.ok(), `status ${r.status()}`);
      assert(await anon.getByText("لبن سموك").first().isVisible(), "product missing");
      assert((await anon.locator('a[href^="https://wa.me/201012345678?text="]').count()) > 0, "WhatsApp order link missing");
    });
    await check("pending store is hidden from the public", async () => {
      const r = await anon.goto(BASE + "/s/smoke-pending");
      assert(r.status() === 404 || (await anon.getByText("لبن سموك").count()) === 0, "pending store visible");
    });
    await check("category page lists store with featured product", async () => {
      await anon.goto(BASE + "/c/groceries", { waitUntil: "networkidle" });
      assert(await anon.getByText("متجر approved").first().isVisible(), "store missing on category page");
    });
    for (const path of ["/", "/en", "/login", "/signup", "/search?q=test"]) {
      await check(`page ${path} loads`, async () => { const r = await anon.goto(BASE + path); assert(r.ok(), `status ${r.status()}`); });
    }
    // ---- admin: never owns a store; delete = soft delete, hidden everywhere immediately ----
    const adm = await newPage("smoke-admin@nazlawi.test");
    adm.on("dialog", (d) => d.accept());
    await check("admin: /dashboard and /onboarding redirect to /admin; no dashboard link", async () => {
      await adm.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
      assert(/\/admin/.test(new URL(adm.url()).pathname), `dashboard landed on ${adm.url()}`);
      await adm.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
      assert(/\/admin/.test(new URL(adm.url()).pathname), `onboarding landed on ${adm.url()}`);
      assert((await adm.locator('header a[href$="/dashboard"]').count()) === 0, "dashboard link visible for admin");
    });
    await check("admin: POST /api/stores → 403 bilingual", async () => {
      const r = await adm.request.post(BASE + "/api/stores?lang=ar", { data: { nameAr: "متجر", nameEn: "Shop", category: "groceries", phone: "01012345678" } });
      assert(r.status() === 403, `status ${r.status()}`);
      assert(((await r.json()).error.message || "").includes("الإدارة"), "message not Arabic");
    });
    await check("admin: warning lists stores owned by an admin account", async () => {
      await adm.goto(BASE + "/admin", { waitUntil: "networkidle" });
      const box = adm.getByTestId("admin-owned-stores");
      assert(await box.isVisible(), "warning missing");
      assert(await box.getByText("متجر الأدمن").isVisible(), "admin store not listed");
      await shot(adm, "admin-owned-store-warning");
    });
    await check("admin: delete store from the stores list → permanently deleted (DB rows gone), gone from public + list", async () => {
      await adm.goto(BASE + "/admin/stores?status=APPROVED", { waitUntil: "networkidle" });
      await shot(adm, "admin-stores-delete-button");
      const row = adm.locator("li", { hasText: "متجر todelete" });
      const [resp] = await Promise.all([
        adm.waitForResponse((r) => r.url().includes("/api/admin/stores/") && r.request().method() === "DELETE"),
        row.getByTestId("admin-delete-store").click(),
      ]);
      assert(resp.ok(), `delete API ${resp.status()} ${await resp.text()}`);
      await adm.waitForFunction(() => !document.body.innerText.includes("متجر todelete"), null, { timeout: 15000 });
      await adm.reload({ waitUntil: "networkidle" });
      assert((await adm.getByText("متجر todelete").count()) === 0, "deleted store back in the admin list after reload");
      await notFoundPage(anon, "/s/smoke-todelete");
      await anon.goto(BASE + "/c/groceries", { waitUntil: "networkidle" });
      assert((await anon.getByText("متجر todelete").count()) === 0, "deleted store still on category page");
      const api = await anon.request.get(BASE + "/api/stores?category=groceries");
      assert(!(await api.text()).includes("smoke-todelete"), "deleted store still in /api/stores");
      assert((await prisma.store.count({ where: { id: fx.todelete.store.id } })) === 0, "store row still in DB (not hard-deleted)");
      assert((await prisma.listing.count({ where: { storeId: fx.todelete.store.id } })) === 0, "products of deleted store still in DB");
      assert((await prisma.listingGroup.count({ where: { storeId: fx.todelete.store.id } })) === 0, "sections of deleted store still in DB");
    });
    await check("admin: delete product → gone from store page, product page and search", async () => {
      const l = await prisma.listing.findFirst({ where: { storeId: fx.approved.store.id } });
      const extra = await prisma.listing.create({ data: { storeId: fx.approved.store.id, ownerId: fx.approved.u.id, category: "groceries", nameAr: "جبنة سموك", nameEn: "Smoke cheese", phone: "01012345678", priceType: "FIXED", priceMinor: 5000, status: "APPROVED" } });
      void l;
      const r = await adm.request.delete(BASE + `/api/admin/listings/${extra.id}`);
      assert(r.ok(), `delete status ${r.status()}`);
      await anon.goto(BASE + "/s/smoke-approved", { waitUntil: "networkidle" });
      assert((await anon.getByText("جبنة سموك").count()) === 0, "deleted product still on store page");
      await notFoundPage(anon, `/p/${extra.id}`);
      const sr = await anon.request.get(BASE + "/api/listings?q=" + encodeURIComponent("جبنة"));
      assert(!(await sr.text()).includes(extra.id), "deleted product in search API");
      assert((await prisma.listing.count({ where: { id: extra.id } })) === 0, "product row still in DB (not hard-deleted)");
    });
    await check("service worker v6 does not cache API responses", async () => {
      const sw = await (await anon.request.get(BASE + "/sw.js")).text();
      assert(sw.includes('"v6"'), "sw version not bumped");
      assert(!/api\\\/\(listings/.test(sw), "sw still caches /api/listings");
    });
    await adm.context().close();

    // ---- map location everywhere ----
    const prov = await newPage("smoke-approved@nazlawi.test");
    await check("map: resident/profile address picker in settings", async () => {
      await prov.goto(BASE + "/settings", { waitUntil: "networkidle" });
      assert(await prov.getByTestId("addr-field").isVisible(), "address map missing");
      await prov.waitForSelector('[data-testid="addr-field"] .leaflet-container', { timeout: 15000 });
      await shot(prov, "map-settings-address");
    });
    await check("map: product form has optional location picker", async () => {
      await prov.goto(BASE + "/dashboard?tab=products", { waitUntil: "networkidle" });
      await prov.getByRole("button", { name: /إضافة منتج/ }).last().click();
      const d = prov.getByTestId("product-location");
      await d.locator("summary").click();
      await prov.waitForSelector('[data-testid="pf-loc-field"] .leaflet-container', { timeout: 15000 });
      await shot(prov, "map-product-form");
    });
    await check("map: legacy listing edit page has location picker", async () => {
      const l = await prisma.listing.findFirst({ where: { storeId: fx.approved.store.id, deletedAt: null } });
      await prov.goto(BASE + `/dashboard/edit/${l.id}`, { waitUntil: "networkidle" });
      assert(await prov.getByTestId("lf-loc-field").isVisible(), "listing location picker missing");
      await shot(prov, "map-listing-edit");
    });
    await prov.context().close();
    await check("map: store page + product page show map with Google Maps directions", async () => {
      await anon.goto(BASE + "/s/smoke-approved", { waitUntil: "networkidle" });
      assert((await anon.locator('a[href^="https://www.google.com/maps/dir/"]').count()) > 0, "store directions link missing");
      await shot(anon, "map-store-page");
      const l = await prisma.listing.findFirst({ where: { storeId: fx.approved.store.id, deletedAt: null } });
      await anon.goto(BASE + `/p/${l.id}`, { waitUntil: "networkidle" });
      assert(await anon.getByTestId("product-map").isVisible(), "product map missing");
      assert((await anon.locator('a[href^="https://www.google.com/maps/dir/?api=1&destination=30.0444,31.2357"]').count()) > 0, "product directions link missing");
      await shot(anon, "map-product-page");
    });

    await check("upload token route requires auth (JSON 401)", async () => {
      const r = await anon.request.post(BASE + "/api/uploads/token", { data: {} });
      assert([401, 404].includes(r.status()), `status ${r.status()}`);
    });
    await browser.close();
    code = results.some((r) => r[0] === "FAIL") ? 1 : 0;
  } finally {
    try { process.kill(-server.pid); } catch {}
    await cleanup();
    await prisma.$disconnect();
    for (const r of results) console.log(r.join("  "));
    console.log(code ? "SMOKE FAILED" : `SMOKE OK (${results.length} checks)`);
  }
  process.exit(code);
}
main().catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exit(1); });
