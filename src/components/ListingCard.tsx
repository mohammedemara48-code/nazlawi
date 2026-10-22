import Link from "next/link";
import type { Listing, ListingImage } from "@prisma/client";
import type { Locale } from "@/lib/constants";
import { AVAILABILITY_CATEGORIES } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import PriceTag from "./PriceTag";

type L = Omit<Listing, "searchText"> & { images?: Pick<ListingImage, "key">[]; store?: { slug: string; nameAr: string; nameEn: string } | null };
export const waLink = (n: string) => `https://wa.me/${n.replace(/^\+/, "").replace(/^0/, "20")}`;

/** Full card (search results, store page). `compact` = small card for the store row on category pages. */
export default function ListingCard({ p, lang, compact }: { p: L; lang: Locale; compact?: boolean }) {
  const t = dict(lang);
  const name = lang === "en" ? p.nameEn : p.nameAr;
  const desc = lang === "en" ? p.descEn : p.descAr;
  const img = p.images?.[0];
  if (compact) {
    return (
      <Link href={href(lang, `/p/${p.id}`)} className="card block w-44 shrink-0 overflow-hidden transition hover:shadow-md sm:w-52">
        {img ? <img src={`/api/uploads/${img.key}`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          : <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#F2D49B]/50 text-3xl">🛍️</div>}
        <div className="space-y-1 p-3">
          <h4 className="line-clamp-1 text-sm font-bold">{name}</h4>
          <PriceTag p={p} lang={lang} />
          {desc && <p className="line-clamp-1 text-xs text-stone-500">{desc}</p>}
        </div>
      </Link>
    );
  }
  const showAvail = AVAILABILITY_CATEGORIES.includes(p.category);
  return (
    <article className="card flex flex-col gap-3 overflow-hidden p-4">
      {img && (
        <Link href={href(lang, `/p/${p.id}`)} className="-mx-4 -mt-4 block">
          <img src={`/api/uploads/${img.key}`} alt={name} loading="lazy" className="aspect-[16/9] w-full object-cover" />
        </Link>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold"><Link href={href(lang, `/p/${p.id}`)} className="hover:text-[#C0532F]">{name}</Link></h3>
        <div className="flex shrink-0 gap-1 text-xs">
          {p.featuredPosition != null && <span className="rounded-full bg-[#C0532F]/10 px-2 py-1 text-[#C0532F]">★ {t.featured}</span>}
          {p.isExample && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{t.example}</span>}
          {showAvail && <span className={`rounded-full px-2 py-1 ${p.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>{p.available ? t.available : t.unavailable}</span>}
        </div>
      </div>
      <PriceTag p={p} lang={lang} />
      {p.store && <Link href={href(lang, `/s/${p.store.slug}`)} className="text-xs font-medium text-[#C0532F]">🏪 {lang === "en" ? p.store.nameEn : p.store.nameAr}</Link>}
      {desc && <p className="line-clamp-3 text-sm text-stone-600">{desc}</p>}
      <div className="mt-auto flex gap-2">
        <a href={`tel:${p.phone}`} className="btn-primary flex-1 text-sm">📞 {t.call}</a>
        <a href={waLink(p.whatsapp || p.phone)} target="_blank" rel="noopener noreferrer" className="btn flex-1 bg-emerald-600 text-sm text-white hover:bg-emerald-700">💬 {t.whatsapp}</a>
      </div>
    </article>
  );
}
