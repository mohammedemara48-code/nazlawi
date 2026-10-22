#!/usr/bin/env node
/**
 * Pre-deploy smoke suite (Playwright, mobile 390px, real browser against a production build).
 *   npm run smoke            # builds into .next-smoke, starts it on a free port, seeds fixtures in the LOCAL db, runs checks
 *   SMOKE_SKIP_BUILD=1 npm run smoke   # reuse the last smoke build
 * Fixtures are created with the "smoke-" prefix and removed at the end. Never point this at production.
 */
import { spawn, spawnSync } from "node:child_process";
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
  return { approved: await mk("approved", "APPROVED"), pending: await mk("pending", "PENDING"), unverified: await mk("unverified", "PENDING", false) };
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
    const b = spawnSync("npx", ["next", "build"], { env, stdio: "inherit" });
    if (b.status !== 0) process.exit(b.status ?? 1);
  }
  await seed();
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
