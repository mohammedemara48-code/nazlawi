import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import type { activePromotions } from "@/lib/services/promotions";
import PriceTag from "./PriceTag";

type Items = Awaited<ReturnType<typeof activePromotions>>;
/** Story-style horizontal strip of active promotions ("عروض مميزة"). */
export default function PromoStrip({ items, lang }: { items: Items; lang: Locale }) {
  const t = dict(lang);
  if (!items.length) return null;
  return (
    <section aria-label={t.promoStrip} className="mx-auto max-w-3xl">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-stone-800">🔥 {t.promoStrip}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((p) => (
          <Link key={p.id} href={href(lang, p.href)} className="group flex w-20 shrink-0 flex-col items-center gap-1 text-center sm:w-24">
            <span className="relative block rounded-full bg-gradient-to-tr from-[#C0532F] via-[#E8955F] to-[#F2D49B] p-[3px]">
              <span className="block overflow-hidden rounded-full border-2 border-white bg-white">
                {p.imageKey ? <img src={`/api/uploads/${p.imageKey}`} alt="" className="h-16 w-16 object-cover sm:h-20 sm:w-20" />
                  : <span className="flex h-16 w-16 items-center justify-center text-2xl sm:h-20 sm:w-20">🛍️</span>}
              </span>
              {p.videoKey && <span className="absolute bottom-0 end-0 rounded-full bg-[#C0532F] px-1.5 text-[10px] text-white">▶</span>}
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-stone-800">{lang === "en" ? p.titleEn : p.titleAr}</span>
            {p.price && <PriceTag p={p.price} lang={lang} size="xs" />}
            {p.isExample && <span className="text-[9px] text-amber-700">{t.example}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
