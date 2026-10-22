// Captures screenshots from the local dev server only (http://localhost:3100).
// PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 (set in package.json) makes setOffline() apply to the service worker too.
import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error("Screenshots must target localhost");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = async (path: string, file: string) => {
    const r = await page.goto(BASE + path, { waitUntil: "networkidle" });
    console.log(path, r?.status(), await page.title());
    await page.screenshot({ path: `docs/screenshots/${file}`, fullPage: true });
  };
  await shot("/", "home-ar.png");
  await shot("/en", "home-en.png");
  await shot("/c/medical", "category-medical-ar.png");
  await shot("/c/rides", "category-rides-ar.png");
  await shot("/search?q=%D8%A7%D9%84%D8%A7%D9%85%D9%84", "search-ar.png");
  await shot("/does-not-exist", "404-ar.png");
  await page.goto(BASE + "/login");
  await page.fill("#email", "provider@example.com");
  await page.fill("#password", "password123");
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit], form button.btn-primary")]);
  await shot("/dashboard", "dashboard-ar.png");
  await shot("/en/dashboard/new", "dashboard-new-en.png");
  await shot("/settings", "settings-ar.png");

  // Upload two images to the provider's first grocery listing via the API (same as the UI uploader).
  const fs = await import("node:fs");
  const sharp = (await import("sharp")).default;
  const mine = await (await page.request.get(BASE + "/api/me/listings?category=groceries")).json();
  const target = mine.items.find((p: { status: string }) => p.status === "APPROVED");
  const hero = fs.readFileSync("public/village-hero.jpg");
  const crops = [await sharp(hero).extract({ left: 0, top: 250, width: 900, height: 600 }).jpeg().toBuffer(), await sharp(hero).extract({ left: 700, top: 150, width: 900, height: 600 }).jpeg().toBuffer()];
  for (const [i, buf] of crops.entries()) {
    const r = await page.request.post(`${BASE}/api/listings/${target.id}/images`, { multipart: { file: { name: `demo-${i}.jpg`, mimeType: "image/jpeg", buffer: buf } } });
    console.log("upload", r.status());
  }
  await shot(`/dashboard/edit/${target.id}`, "dashboard-edit-images-ar.png");
  await shot(`/p/${target.id}`, "listing-with-images-ar.png");
  await shot("/c/groceries", "category-groceries-images-ar.png");
  await ctx.clearCookies();
  await page.goto(BASE + "/en/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "password123");
  await Promise.all([page.waitForURL("**/dashboard"), page.click("form button.btn-primary")]);
  await shot("/en/admin", "admin-en.png");
  // Some admin actions so the audit log has entries.
  const users = await (await page.request.get(BASE + "/api/admin/users?q=resident")).json();
  const resident = users.items[0];
  for (const body of [{ role: "PROVIDER" }, { role: "RESIDENT" }, { status: "SUSPENDED" }, { status: "ACTIVE" }]) {
    await page.request.patch(`${BASE}/api/admin/users/${resident.id}`, { data: body });
  }
  const unv = (await (await page.request.get(BASE + "/api/admin/users?q=unverified")).json()).items[0];
  await page.request.post(`${BASE}/api/admin/users/${unv.id}/resend-verification`);
  const pend = (await (await page.request.get(BASE + "/api/admin/listings?status=PENDING")).json()).items[0];
  if (pend) await page.request.patch(`${BASE}/api/admin/listings/${pend.id}/status`, { data: { status: "HIDDEN" } });
  await shot("/admin/users", "admin-users-ar.png");
  await shot("/en/admin/audit", "audit-log-en.png");
  await shot("/settings", "settings-admin-ar.png");
  // Password reset flow: request -> dev outbox -> reset page.
  await ctx.clearCookies();
  await page.goto(BASE + "/forgot-password");
  await page.fill("#email", "resident@example.com");
  await page.click("form button.btn-primary");
  await page.waitForSelector("[role=status]");
  await page.screenshot({ path: "docs/screenshots/forgot-password-sent-ar.png", fullPage: true });
  await shot("/dev/outbox", "dev-outbox-ar.png");
  const link = await page.locator("a[href*='reset-password?token=']").first().getAttribute("href");
  await shot(new URL(link!).pathname + new URL(link!).search, "reset-password-ar.png");
  await page.fill("#password", "password123");
  await page.click("form button.btn-primary");
  await page.waitForSelector("[role=status]");
  await page.screenshot({ path: "docs/screenshots/reset-password-done-ar.png", fullPage: true });

  // Offline: in a fresh context, let the SW install, visit a page (so it is "recently viewed"),
  // then go offline and navigate once. A fresh context per shot because Chromium can restart an
  // idle service worker without the offline emulation.
  for (const [path, file] of [["/never-visited", "offline-ar.png"], ["/en/never-visited", "offline-en.png"], ["/c/rides", "offline-cached-page-ar.png"]]) {
    const off = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const op = await off.newPage();
    await op.goto(BASE + "/", { waitUntil: "networkidle" });
    await op.evaluate(async () => { await navigator.serviceWorker.ready; });
    await op.reload({ waitUntil: "networkidle" });
    await op.goto(BASE + "/c/rides", { waitUntil: "networkidle" });
    await op.waitForTimeout(800);
    await off.setOffline(true);
    await op.goto(BASE + path);
    await op.screenshot({ path: `docs/screenshots/${file}`, fullPage: true });
    console.log("offline", path, "->", await op.title());
    await off.close();
  }

  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await mp.goto(BASE + "/", { waitUntil: "networkidle" });
  await mp.screenshot({ path: "docs/screenshots/home-ar-mobile.png", fullPage: true });
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})();
