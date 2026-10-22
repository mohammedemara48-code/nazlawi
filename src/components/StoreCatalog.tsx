"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { href } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";
import { formatPrice, formatMoney } from "@/lib/price";
import { waOrderLink } from "@/lib/store-hours";

export type CatalogProduct = {
  id: string; groupId: string | null; nameAr: string; nameEn: string; descAr: string; descEn: string;
  priceType: string; priceMinor: number | null; oldPriceMinor: number | null; currency: string; unit: string | null; unitAr: string; unitEn: string;
  available: boolean; featuredPosition: number | null; images: { key: string }[];
};
type Section = { id: string; nameAr: string; nameEn: string };
const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\u064B-\u0652]/g, "");

/** Public catalog: sticky section tabs (scroll to section), in-store search, 2-column product grid with WhatsApp order. */
export default function StoreCatalog({ lang, sections, products, whatsapp, storeName }: { lang: Locale; sections: Section[]; products: CatalogProduct[]; whatsapp: string | null; storeName: string }) {
  const en = lang === "en";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"default" | "price_asc" | "price_desc">("default");
  const groups = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const match = (p: CatalogProduct) => !words.length || words.every((w) => norm(`${p.nameAr} ${p.nameEn} ${p.descAr} ${p.descEn}`).includes(w));
    const list = products.filter(match);
    if (sort !== "default") list.sort((a, b) => ((a.priceMinor ?? Infinity) - (b.priceMinor ?? Infinity)) * (sort === "price_asc" ? 1 : -1));
    const out = sections.map((s) => ({ id: s.id, name: en ? s.nameEn || s.nameAr : s.nameAr, items: list.filter((p) => p.groupId === s.id) }));
    const featured = !words.length && sort === "default" ? list.filter((p) => p.featuredPosition != null).sort((a, b) => a.featuredPosition! - b.featuredPosition!) : [];
    if (featured.length) out.unshift({ id: "featured", name: en ? "★ Featured" : "★ المميز", items: featured });
    out.push({ id: "other", name: en ? "Other" : "أخرى", items: list.filter((p) => !p.groupId || !sections.some((s) => s.id === p.groupId)) });
    return out.filter((g) => g.items.length);
  }, [q, sort, products, sections, en]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (!products.length) return <p className="card p-8 text-center text-stone-500">{en ? "This store hasn't added products yet." : "المتجر لسه مضافش منتجات."}</p>;
  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-[#FBF3EA]/95 px-4 py-2 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">{en ? "Search in this store" : "ابحث في المتجر"}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={en ? "Search in this store…" : "ابحث في المتجر…"} className="input pe-9" />
          <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          {en ? "Sort" : "ترتيب"}
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input h-8 w-auto py-0 text-xs">
            <option value="default">{en ? "Store order" : "ترتيب المتجر"}</option>
            <option value="price_asc">{en ? "Price: low to high" : "السعر: الأقل أولاً"}</option>
            <option value="price_desc">{en ? "Price: high to low" : "السعر: الأعلى أولاً"}</option>
          </select>
        </label>
        {groups.length > 1 && (
          <nav aria-label={en ? "Sections" : "الأقسام"} className="flex gap-2 overflow-x-auto pb-1">
            {groups.map((g) => (
              <a key={g.id} href={`#sec-${g.id}`} className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium hover:border-[#C0532F] hover:text-[#C0532F]">
                {g.name} <span className="text-xs text-stone-400">{g.items.length}</span>
              </a>
            ))}
          </nav>
        )}
      </div>
      {!total && <p className="card p-6 text-center text-stone-500">{en ? "No products match your search." : "مفيش منتجات مطابقة للبحث."}</p>}
      {groups.map((g) => (
        <div key={g.id} id={`sec-${g.id}`} className="scroll-mt-28 space-y-3">
          <h2 className="text-lg font-bold">{g.name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((p) => <ProductCard key={`${g.id}-${p.id}`} p={p} lang={lang} whatsapp={whatsapp} storeName={storeName} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ProductCard({ p, lang, whatsapp }: { p: CatalogProduct; lang: Locale; whatsapp: string | null; storeName?: string }) {
  const en = lang === "en";
  const name = en ? p.nameEn || p.nameAr : p.nameAr;
  const f = formatPrice(p, lang);
  const img = p.images[0];
  const priceAr = p.priceMinor != null ? formatMoney(p.priceMinor, p.currency, "ar").replace(" ج.م", "") : "";
  const msg = `أهلاً، عايز أطلب ${p.nameAr} — ${priceAr} جنيه (من نزلاوي)`;
  return (
    <article className={`card flex flex-col overflow-hidden ${p.available ? "" : "opacity-75"}`}>
      <Link href={href(lang, `/p/${p.id}`)} className="relative block">
        {img ? <img src={`/api/uploads/${img.key}`} alt={name} loading="lazy" className="aspect-square w-full object-cover" />
          : <div className="flex aspect-square w-full items-center justify-center bg-[#F2D49B]/40 text-4xl" aria-hidden>🛒</div>}
        {!p.available && <span className="absolute start-2 top-2 rounded-full bg-stone-800/85 px-2 py-0.5 text-[11px] font-semibold text-white">{en ? "Out of stock" : "غير متوفر"}</span>}
        {p.featuredPosition != null && <span className="absolute end-2 top-2 rounded-full bg-white/90 px-1.5 text-sm text-amber-500" title={en ? "Featured" : "مميز"}>★</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 text-sm font-bold leading-5"><Link href={href(lang, `/p/${p.id}`)} className="hover:text-[#C0532F]">{name}</Link></h3>
        <p className="text-[15px] font-bold text-[#C0532F]">{f.main}</p>
        {f.old && <p className="text-xs text-stone-400"><s>{f.old}</s>{f.discountPct ? <span className="ms-1 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-800">−{f.discountPct}%</span> : null}</p>}
        {whatsapp && p.available && (
          <a href={waOrderLink(whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn mt-auto bg-emerald-600 px-2 py-1.5 text-xs text-white hover:bg-emerald-700">
            💬 {en ? "Order on WhatsApp" : "اطلب واتساب"}
          </a>
        )}
      </div>
    </article>
  );
}
