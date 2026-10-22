// Phase-4 screenshots (stores, featured, promotions, prices). Local dev server only.
import { chromium, type Page } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error("Screenshots must target localhost");

(async () => {
  const browser = await chromium.launch();
  const errors: string[] = [];
  const fresh = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    return page;
  };
  const shot = async (page: Page, path: string, file: string, full = true) => {
    const r = await page.goto(BASE + path, { waitUntil: "networkidle" });
    console.log(path, r?.status());
    await page.screenshot({ path: `screenshots/${file}`, fullPage: full });
  };
  const login = async (page: Page, email: string, lang = "") => {
    await page.goto(`${BASE}${lang}/login`);
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await Promise.all([page.waitForURL(/dashboard|onboarding|admin/), page.click("form button.btn-primary")]);
  };

  let page = await fresh();
  await shot(page, "/", "home-promo-strip-ar.png", false);
  await shot(page, "/c/groceries", "category-stores-ar.png");
  await shot(page, "/c/groceries?sort=price_asc&minPrice=10&maxPrice=200", "category-price-filter-ar.png");
  await shot(page, "/s/al-amal-grocery", "store-page-ar.png");
  await shot(page, "/en/s/al-shiaka", "store-page-en.png");
  const store = await (await page.request.get(BASE + "/api/stores/by-slug/al-amal-grocery")).json();
  await shot(page, `/p/${store.featured[0].id}`, "listing-price-ar.png");

  page = await fresh();
  await login(page, "newprovider@example.com");
  await shot(page, "/onboarding", "provider-onboarding-ar.png");

  page = await fresh();
  await login(page, "provider@example.com");
  await shot(page, "/dashboard", "dashboard-featured-ar.png");
  await shot(page, "/dashboard/new", "dashboard-new-price-ar.png");

  page = await fresh();
  await login(page, "admin@example.com", "/en");
  await shot(page, "/en/admin/promotions", "admin-promotions-en.png");
  await shot(page, "/en/admin/stores", "admin-stores-en.png");
  await shot(page, "/en/admin/videos", "admin-videos-en.png");

  await browser.close();
  if (errors.length) { console.error("Page errors:", errors); process.exit(1); }
})();
