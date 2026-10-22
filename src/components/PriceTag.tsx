import type { Locale } from "@/lib/constants";
import { formatPrice, type Priced } from "@/lib/price";

/** Price line used on every listing surface. size: sm (cards/strip) | lg (listing page). */
export default function PriceTag({ p, lang, size = "sm" }: { p: Priced; lang: Locale; size?: "xs" | "sm" | "lg" }) {
  const f = formatPrice(p, lang);
  const main = size === "lg" ? "text-2xl" : size === "xs" ? "text-[11px]" : "text-base";
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" aria-label={f.old ? `${f.main} (${f.old})` : f.main}>
      <span className={`${main} font-bold ${f.hasAmount ? "text-[#C0532F]" : "text-stone-500"}`}>{f.main}</span>
      {f.old && size !== "xs" && <s className="text-xs text-stone-400">{f.old}</s>}
      {f.discountPct && size !== "xs" && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">−{f.discountPct}%</span>}
    </p>
  );
}
