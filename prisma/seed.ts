// Demo data. Everything here is FAKE, labelled "(مثال)/(example)" and flagged isExample=true.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalize } from "../src/lib/services/text";
import { storage } from "../src/lib/storage";
import { processVideo } from "../src/lib/services/videos";

const prisma = new PrismaClient();
type PriceType = "FIXED" | "FROM" | "NEGOTIABLE" | "ON_REQUEST";
// [nameAr, nameEn, descAr, descEn, priceType, priceEGP, oldPriceEGP, unitAr, unitEn, group index]
type L = [string, string, string, string, PriceType, number | null, number | null, string, string, number?];
type S = { email: string; owner: string; slug: string; category: string; sub?: string; nameAr: string; nameEn: string; bioAr: string; bioEn: string; area: string; color: string; groups?: [string, string][]; listings: L[]; featured: number[] };

const STORES: S[] = [
  { email: "provider@example.com", owner: "مقدم خدمة تجريبي", slug: "al-amal-grocery", category: "groceries", nameAr: "بقالة الأمل (مثال)", nameEn: "Al-Amal Grocery (example)", bioAr: "خضار وفاكهة وألبان طازجة يومياً، وتوصيل داخل القرية.", bioEn: "Fresh vegetables, fruit and dairy daily, with delivery in the village.", area: "الشارع الرئيسي", color: "#2E7D32",
    groups: [["خضار وفاكهة", "Fruit & veg"], ["ألبان", "Dairy"]],
    listings: [
      ["طماطم بلدي (مثال)", "Local tomatoes (example)", "طماطم طازجة من الغيط", "Fresh tomatoes from the field", "FIXED", 15, 18, "للكيلو", "per kg", 0],
      ["جبنة قريش (مثال)", "Cottage cheese (example)", "جبنة قريش فلاحي", "Farm-style cottage cheese", "FIXED", 60, null, "للكيلو", "per kg", 1],
      ["لبن جاموسي (مثال)", "Buffalo milk (example)", "لبن طازج كل صباح", "Fresh milk every morning", "FIXED", 35, null, "للتر", "per litre", 1],
      ["بطاطس (مثال)", "Potatoes (example)", "بطاطس تحمير", "Frying potatoes", "FIXED", 12.5, null, "للكيلو", "per kg", 0],
      ["سلة خضار أسبوعية (مثال)", "Weekly veg box (example)", "تشكيلة خضار للأسرة", "Mixed vegetables for a family", "FROM", 150, null, "", "", 0],
    ], featured: [0, 4, 1] },
  { email: "provider2@example.com", owner: "صاحب محل ملابس (مثال)", slug: "al-shiaka", category: "clothing", nameAr: "محل الشياكة (مثال)", nameEn: "Al-Shiaka Clothing (example)", bioAr: "ملابس رجالي وحريمي وأطفال بأسعار مناسبة.", bioEn: "Men's, women's and kids' clothing at fair prices.", area: "سوق الثلاثاء", color: "#6A1B9A",
    listings: [
      ["جلابية رجالي (مثال)", "Men's galabiya (example)", "قطن مصري", "Egyptian cotton", "FIXED", 450, 550, "", "", undefined],
      ["طقم أطفال (مثال)", "Kids' outfit (example)", "مقاسات من ٢ لـ ١٠ سنين", "Sizes 2–10 years", "FROM", 200, null, "", "", undefined],
      ["تفصيل جلابية (مثال)", "Custom galabiya (example)", "تفصيل على المقاس", "Made to measure", "NEGOTIABLE", 600, null, "", "", undefined],
    ], featured: [0, 1, 2] },
  { email: "provider3@example.com", owner: "معلم بناء (مثال)", slug: "al-fallah-building", category: "construction", nameAr: "مواد بناء الفلاح (مثال)", nameEn: "Al-Fallah Building Materials (example)", bioAr: "طوب أحمر وأسمنت وحديد ورمل مع النقل.", bioEn: "Red brick, cement, steel and sand, with transport.", area: "مدخل القرية", color: "#BF360C",
    listings: [
      ["أسمنت (مثال)", "Cement (example)", "شيكارة ٥٠ كيلو", "50 kg bag", "FIXED", 180, null, "للشيكارة", "per bag", undefined],
      ["طوب أحمر (مثال)", "Red brick (example)", "طوب مصمت", "Solid brick", "FIXED", 1800, null, "للألف", "per 1000", undefined],
      ["حديد تسليح (مثال)", "Rebar steel (example)", "حسب السوق", "Market price", "ON_REQUEST", null, null, "", "", undefined],
    ], featured: [1, 0] },
  { email: "provider4@example.com", owner: "سائق توكتوك (مثال)", slug: "abu-ali-rides", category: "rides", nameAr: "توكتوك أبو علي (مثال)", nameEn: "Abu Ali Tuk-tuk (example)", bioAr: "مشاوير داخل القرية وللموقف.", bioEn: "Trips inside the village and to the station.", area: "الموقف", color: "#F9A825",
    listings: [
      ["مشوار داخل القرية (مثال)", "Village trip (example)", "أي مكان داخل القرية", "Anywhere in the village", "FIXED", 10, null, "للمشوار", "per trip", undefined],
      ["مشوار للمركز (مثال)", "Trip to town (example)", "للمركز والرجوع", "To town and back", "FROM", 60, null, "", "", undefined],
    ], featured: [0, 1] },
  { email: "provider5@example.com", owner: "سائق نقل (مثال)", slug: "karim-transport", category: "transport", nameAr: "نقل ربع - كريم (مثال)", nameEn: "Karim Quarter Truck (example)", bioAr: "نقل عفش وبضائع ومحاصيل.", bioEn: "Furniture, goods and crop moving.", area: "الجمعية الزراعية", color: "#1565C0",
    listings: [
      ["نقل عفش (مثال)", "Furniture moving (example)", "داخل وخارج القرية", "Inside and outside the village", "NEGOTIABLE", 500, null, "", "", undefined],
      ["نقل محاصيل (مثال)", "Crop transport (example)", "للسوق أو الشونة", "To market or silo", "FROM", 250, null, "للنقلة", "per load", undefined],
    ], featured: [0] },
  { email: "provider6@example.com", owner: "د. سارة (مثال)", slug: "dr-sara-pediatrics", category: "medical", sub: "doctors", nameAr: "عيادة د. سارة - أطفال (مثال)", nameEn: "Dr. Sara Pediatrics (example)", bioAr: "عيادة أطفال، يومياً من ٥ لـ ٩ مساءً.", bioEn: "Pediatric clinic, daily 5–9 PM.", area: "شارع المدرسة", color: "#00838F",
    listings: [
      ["كشف أطفال (مثال)", "Pediatric visit (example)", "كشف وإعادة خلال أسبوع", "Visit with a free follow-up within a week", "FIXED", 200, null, "", "", undefined],
      ["متابعة تطعيمات (مثال)", "Vaccination follow-up (example)", "متابعة جدول التطعيمات", "Vaccination schedule follow-up", "FIXED", 100, null, "", "", undefined],
    ], featured: [0, 1] },
  { email: "provider7@example.com", owner: "صيدلي (مثال)", slug: "al-shifa-pharmacy", category: "medical", sub: "pharmacies", nameAr: "صيدلية الشفاء (مثال)", nameEn: "Al-Shifa Pharmacy (example)", bioAr: "مفتوحة ٢٤ ساعة مع توصيل.", bioEn: "Open 24h with delivery.", area: "الشارع الرئيسي", color: "#2E7D32",
    listings: [
      ["قياس ضغط وسكر (مثال)", "BP & sugar check (example)", "قياس سريع", "Quick check", "FIXED", 20, null, "", "", undefined],
      ["توصيل أدوية (مثال)", "Medicine delivery (example)", "داخل القرية", "Inside the village", "ON_REQUEST", null, null, "", "", undefined],
    ], featured: [0] },
];

const svg = (w: number, h: number, color: string, text: string) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#3b2a20"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="55%" font-size="${Math.round(h / 3)}" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${text}</text></svg>`);
async function img(prefix: string, w: number, h: number, color: string, text: string) {
  const key = `${prefix}/${Math.random().toString(36).slice(2, 12)}.webp`;
  await storage.put(key, await sharp(svg(w, h, color, text)).webp({ quality: 80 }).toBuffer(), "image/webp");
  return key;
}
async function demoVideo() {
  const f = path.join(os.tmpdir(), `nz-demo-${Date.now()}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f]);
  const file = new File([fs.readFileSync(f)], "demo.mp4", { type: "video/mp4" });
  fs.rmSync(f, { force: true });
  return processVideo(file);
}
const minor = (v: number | null) => (v == null ? null : Math.round(v * 100));

async function main() {
  // Clean previous demo content (cascade removes listings, groups, images, videos, promotions).
  await prisma.promotion.deleteMany({ where: { isExample: true } });
  await prisma.video.deleteMany({ where: { isExample: true } }); // cascades VideoJob
  await prisma.listing.deleteMany({ where: { isExample: true } });
  await prisma.store.deleteMany({ where: { isExample: true } });

  const pw = await bcrypt.hash("password123", 12);
  const up = (email: string, name: string, role: string, extra: Record<string, unknown> = {}) =>
    prisma.user.upsert({ where: { email }, update: { name, role, status: "ACTIVE", emailVerified: new Date(), password: pw, sessionVersion: 0, ...extra }, create: { email, name, role, password: pw, emailVerified: new Date(), ...extra } });
  const admin = await up("admin@example.com", "Admin (example)", "ADMIN");
  await up("resident@example.com", "ساكن تجريبي", "RESIDENT");
  await prisma.user.upsert({ where: { email: "unverified@example.com" }, update: { emailVerified: null, status: "ACTIVE" }, create: { email: "unverified@example.com", name: "مستخدم غير مؤكد (مثال)", role: "PROVIDER", password: pw } });
  await prisma.user.upsert({ where: { email: "suspended@example.com" }, update: { status: "SUSPENDED" }, create: { email: "suspended@example.com", name: "Suspended user (example)", role: "RESIDENT", status: "SUSPENDED", password: pw, emailVerified: new Date(), locale: "en" } });
  // A provider with no store yet, to demo onboarding.
  await up("newprovider@example.com", "مقدم خدمة جديد (مثال)", "PROVIDER");

  const created: { storeId: string; ownerId: string; listingIds: string[]; category: string }[] = [];
  let n = 0;
  for (const s of STORES) {
    const owner = await up(s.email, s.owner, "PROVIDER");
    const store = await prisma.store.create({ data: {
      slug: s.slug, ownerId: owner.id, category: s.category, subcategory: s.sub ?? null, nameAr: s.nameAr, nameEn: s.nameEn, bioAr: s.bioAr, bioEn: s.bioEn,
      phone: `0100000${String(++n).padStart(4, "0")}`, whatsapp: `0100000${String(n).padStart(4, "0")}`, addressAr: s.area, area: s.area, status: "APPROVED", isExample: true,
      logoKey: await img("stores", 256, 256, s.color, s.nameEn[0]), coverKey: await img("stores", 1200, 400, s.color, "مثال"),
      searchText: normalize([s.nameAr, s.nameEn, s.bioAr, s.bioEn, s.area].join(" ")),
    } });
    const groups = [];
    for (const [i, [nameAr, nameEn]] of (s.groups ?? []).entries()) groups.push(await prisma.listingGroup.create({ data: { storeId: store.id, nameAr, nameEn, position: i } }));
    const ids: string[] = [];
    for (const [i, [nameAr, nameEn, descAr, descEn, priceType, price, old, unitAr, unitEn, g]] of s.listings.entries()) {
      const fp = s.featured.indexOf(i);
      const l = await prisma.listing.create({ data: {
        storeId: store.id, ownerId: owner.id, groupId: g != null ? groups[g]?.id : null, category: s.category, subcategory: s.sub ?? null,
        nameAr, nameEn, descAr, descEn, phone: store.phone, whatsapp: store.whatsapp, available: true, status: "APPROVED", isExample: true,
        priceType, priceMinor: minor(price), oldPriceMinor: minor(old), currency: "EGP", unitAr, unitEn, featuredPosition: fp >= 0 ? fp : null,
        searchText: normalize([nameAr, nameEn, descAr, descEn].join(" ")),
      } });
      await prisma.listingImage.create({ data: { listingId: l.id, key: await img("listings", 600, 450, s.color, String(i + 1)), width: 600, height: 450, position: 0 } });
      ids.push(l.id);
    }
    created.push({ storeId: store.id, ownerId: owner.id, listingIds: ids, category: s.category });
  }
  // A pending listing to show the review flow.
  const first = created[0];
  await prisma.listing.create({ data: { storeId: first.storeId, ownerId: first.ownerId, category: "groceries", nameAr: "عسل نحل (مثال - قيد المراجعة)", nameEn: "Bee honey (example - pending)", phone: "01000000001", status: "PENDING", isExample: true, priceType: "FIXED", priceMinor: 25000, searchText: normalize("عسل نحل Bee honey") } });
  // A pending store to moderate.
  const pend = await up("provider8@example.com", "صاحب معمل (مثال)", "PROVIDER");
  await prisma.store.create({ data: { slug: "al-hayah-lab", ownerId: pend.id, category: "medical", subcategory: "labs", nameAr: "معمل الحياة للتحاليل (مثال)", nameEn: "Al-Hayah Lab (example)", phone: "01000000099", status: "PENDING", isExample: true, searchText: normalize("معمل الحياة Al-Hayah Lab") } });

  // One short ffmpeg-generated demo video on the grocery store (approved) and one pending on a listing.
  const v = await demoVideo();
  for (const [target, status] of [[{ storeId: first.storeId }, "APPROVED"], [{ listingId: created[1].listingIds[0] }, "PENDING"]] as const) {
    const base = `videos/${Math.random().toString(36).slice(2, 12)}`;
    await storage.put(`${base}.mp4`, v.mp4, "video/mp4");
    await storage.put(`${base}.webp`, v.poster, "image/webp");
    await prisma.video.create({ data: { ...target, ownerId: target === undefined ? admin.id : ("storeId" in target ? first.ownerId : created[1].ownerId), key: `${base}.mp4`, posterKey: `${base}.webp`, durationSec: v.durationSec, width: v.width, height: v.height, sizeBytes: v.mp4.length, status, processing: "READY", isExample: true } });
  }

  // Promotions: several approved & active, one pending request.
  const now = Date.now(), day = 86_400_000;
  const promo = (d: { targetType: string; storeId: string; listingId?: string; category: string; priority: number; status: string; requestedById: string; startsAt?: Date; endsAt?: Date }) =>
    prisma.promotion.create({ data: { startsAt: new Date(now - day), endsAt: new Date(now + 14 * day), isExample: true, ...d } });
  await promo({ targetType: "LISTING", storeId: first.storeId, listingId: first.listingIds[4], category: "groceries", priority: 10, status: "APPROVED", requestedById: first.ownerId });
  await promo({ targetType: "STORE", storeId: created[1].storeId, category: "clothing", priority: 8, status: "APPROVED", requestedById: created[1].ownerId });
  await promo({ targetType: "LISTING", storeId: created[1].storeId, listingId: created[1].listingIds[0], category: "clothing", priority: 7, status: "APPROVED", requestedById: created[1].ownerId });
  await promo({ targetType: "LISTING", storeId: created[5].storeId, listingId: created[5].listingIds[0], category: "medical", priority: 6, status: "APPROVED", requestedById: created[5].ownerId });
  await promo({ targetType: "LISTING", storeId: created[2].storeId, listingId: created[2].listingIds[1], category: "construction", priority: 5, status: "APPROVED", requestedById: created[2].ownerId });
  await promo({ targetType: "STORE", storeId: created[3].storeId, category: "rides", priority: 4, status: "APPROVED", requestedById: created[3].ownerId });
  await promo({ targetType: "LISTING", storeId: created[4].storeId, listingId: created[4].listingIds[0], category: "transport", priority: 0, status: "PENDING", requestedById: created[4].ownerId, startsAt: new Date(now + day), endsAt: new Date(now + 8 * day) });
  console.log(`Seeded ${STORES.length + 1} example stores, demo video, 7 promotions. Password for all users: password123`);
}
main().finally(() => prisma.$disconnect());
