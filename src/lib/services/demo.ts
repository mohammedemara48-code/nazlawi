/**
 * Demo grocery store ("بقالة نزلاوي (تجريبي)") owned by a dedicated, non-loginable demo provider.
 * Everything is flagged isExample and prices are SAMPLE prices. Idempotent create; full removal.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import type { Session } from "../session";
import type { Unit } from "../constants";
import { audit } from "./audit";
import { normalize } from "./text";
import { storage } from "../storage";

export const DEMO_EMAIL = "demo-grocery@nazlawi.app";
export const DEMO_SLUG = "nazlawi-demo-grocery";
type P = [nameAr: string, nameEn: string, price: number, unit: Unit, extra?: { old?: number; featured?: boolean; out?: boolean; descAr?: string }];
export const DEMO_CATALOG: { ar: string; en: string; items: P[] }[] = [
  { ar: "ألبان", en: "Dairy", items: [
    ["لبن كامل الدسم ١ لتر", "Full-cream milk 1 L", 38, "liter", { featured: true, descAr: "لبن بقري طازج" }],
    ["زبادي طبيعي", "Plain yogurt", 9, "piece"],
    ["لبن رايب ١ لتر", "Laban rayeb 1 L", 35, "liter"],
    ["قشطة ٢٠٠ جم", "Cream 200 g", 30, "box"],
  ] },
  { ar: "بيض", en: "Eggs", items: [
    ["بيض أبيض (٣٠ بيضة)", "White eggs (30)", 165, "carton", { old: 180, featured: true }],
    ["بيض أحمر (٣٠ بيضة)", "Brown eggs (30)", 175, "carton"],
    ["بيض بلدي", "Farm eggs", 85, "dozen"],
  ] },
  { ar: "جبن", en: "Cheese", items: [
    ["جبنة بيضاء", "White cheese", 125, "kg"],
    ["جبنة رومي", "Romy cheese", 320, "kg", { featured: true }],
    ["جبنة قريش", "Areesh cheese", 90, "kg"],
    ["جبنة شيدر شرائح ٢٠٠ جم", "Cheddar slices 200 g", 75, "pack", { out: true }],
  ] },
  { ar: "مكرونة", en: "Pasta", items: [
    ["مكرونة قلم ٤٠٠ جم", "Penne 400 g", 22, "pack"],
    ["مكرونة اسباجتي ٤٠٠ جم", "Spaghetti 400 g", 22, "pack"],
    ["شعرية ٣٥٠ جم", "Vermicelli 350 g", 15, "pack"],
  ] },
  { ar: "بقوليات", en: "Legumes", items: [
    ["عدس أصفر", "Yellow lentils", 70, "kg"],
    ["فول مدشوش", "Crushed fava beans", 55, "kg", { old: 60 }],
    ["لوبيا", "Black-eyed peas", 80, "kg"],
    ["فاصوليا بيضاء", "White beans", 85, "kg"],
  ] },
  { ar: "زيوت وسمن", en: "Oils & ghee", items: [
    ["زيت عباد الشمس ١ لتر", "Sunflower oil 1 L", 95, "liter"],
    ["زيت ذرة ١ لتر", "Corn oil 1 L", 110, "liter"],
    ["سمن نباتي", "Vegetable ghee", 120, "kg"],
    ["سمن بلدي", "Farm ghee", 450, "kg"],
  ] },
  { ar: "مشروبات", en: "Drinks", items: [
    ["مياه معدنية ١.٥ لتر", "Mineral water 1.5 L", 8, "piece"],
    ["عصير مانجو ١ لتر", "Mango juice 1 L", 45, "piece"],
    ["شاي ناعم ٢٥٠ جم", "Loose black tea 250 g", 65, "pack"],
  ] },
];
const SAMPLE_AR = "سعر تجريبي للعرض فقط";
const SAMPLE_EN = "Sample price, demo only";

export async function createDemoStore(admin: Session, opts: { whatsapp?: string | null } = {}) {
  const existing = await prisma.store.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) return { store: existing, created: false };
  const owner = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    // Random unknown password: nobody can sign in as the demo provider.
    create: { email: DEMO_EMAIL, name: "Demo grocery (تجريبي)", role: "PROVIDER", emailVerified: new Date(), password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12) },
  });
  const bio = { ar: "متجر تجريبي لعرض شكل المتجر في نزلاوي. الأسعار تجريبية وليست حقيقية.", en: "A demo store showing how a Nazlawi store looks. Prices are samples, not real." };
  const store = await prisma.store.create({
    data: {
      slug: DEMO_SLUG, ownerId: owner.id, category: "groceries", nameAr: "بقالة نزلاوي (تجريبي)", nameEn: "Nazlawi Grocery (demo)",
      bioAr: bio.ar, bioEn: bio.en, phone: "0000000000", whatsapp: opts.whatsapp ?? null, area: "الشارع الرئيسي",
      openTime: "08:00", closeTime: "23:00", hoursNoteAr: "مواعيد تجريبية", hoursNoteEn: "Sample hours",
      status: "APPROVED", isExample: true, searchText: normalize(`بقالة نزلاوي تجريبي nazlawi grocery demo ${bio.ar}`),
    },
  });
  let featured = 0;
  for (const [si, sec] of DEMO_CATALOG.entries()) {
    const g = await prisma.listingGroup.create({ data: { storeId: store.id, nameAr: sec.ar, nameEn: sec.en, position: si } });
    for (const [pi, [nameAr, nameEn, price, unit, x]] of sec.items.entries()) {
      const descAr = [x?.descAr, SAMPLE_AR].filter(Boolean).join(" — ");
      await prisma.listing.create({
        data: {
          storeId: store.id, ownerId: owner.id, groupId: g.id, category: "groceries", nameAr, nameEn, descAr, descEn: SAMPLE_EN,
          phone: store.phone, priceType: "FIXED", priceMinor: price * 100, oldPriceMinor: x?.old ? x.old * 100 : null, unit,
          available: !x?.out, position: pi, status: "APPROVED", isExample: true,
          featuredPosition: x?.featured && featured < 3 ? ++featured : null,
          searchText: normalize(`${nameAr} ${nameEn} ${descAr}`),
        },
      });
    }
  }
  await audit(admin, "DEMO_STORE_CREATED", "STORE", store.id, { slug: DEMO_SLUG });
  return { store, created: true };
}

/** Removes the demo store, its products/sections/images and the demo provider. */
export async function removeDemoStore(admin: Session) {
  const store = await prisma.store.findUnique({ where: { slug: DEMO_SLUG } });
  const owner = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!store && !owner) return { removed: false };
  const keys = store ? [
    ...(await prisma.listingImage.findMany({ where: { listing: { storeId: store.id } }, select: { key: true } })).map((i) => i.key),
    store.logoKey, store.coverKey,
  ].filter((k): k is string => !!k) : [];
  if (owner) await prisma.user.delete({ where: { id: owner.id } }); // cascades store → sections, products, images
  else if (store) await prisma.store.delete({ where: { id: store.id } });
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => {})));
  await audit(admin, "DEMO_STORE_REMOVED", "STORE", store?.id ?? "-", { slug: DEMO_SLUG });
  return { removed: true };
}
