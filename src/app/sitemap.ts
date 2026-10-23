import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/constants";
import { siteUrl } from "@/lib/site";
import { LISTING_PUBLIC, STORE_PUBLIC } from "@/lib/services/visibility";

export const dynamic = "force-dynamic";

/** Public pages in both languages (Arabic at "/", English at "/en"), plus every public store and product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const both = (path: string, lastModified?: Date, priority = 0.5): MetadataRoute.Sitemap => {
    const ar = path === "/" ? base : `${base}${path}`;
    const en = `${base}/en${path === "/" ? "" : path}`;
    const alternates = { languages: { ar, en } };
    return [{ url: ar, lastModified, priority, alternates }, { url: en, lastModified, priority, alternates }];
  };
  const statics = ["/", "/about", "/contact", "/privacy", "/terms", "/invitations", ...CATEGORIES.map((c) => `/c/${c}`)].flatMap((p) => both(p, undefined, p === "/" ? 1 : 0.6));
  try {
    const [stores, products] = await Promise.all([
      prisma.store.findMany({ where: STORE_PUBLIC, select: { slug: true, updatedAt: true }, take: 5000 }),
      prisma.listing.findMany({ where: LISTING_PUBLIC, select: { id: true, updatedAt: true }, take: 20000 }),
    ]);
    return [...statics, ...stores.flatMap((s) => both(`/s/${s.slug}`, s.updatedAt, 0.8)), ...products.flatMap((p) => both(`/p/${p.id}`, p.updatedAt, 0.7))];
  } catch {
    return statics; // DB unavailable (e.g. at build time)
  }
}
