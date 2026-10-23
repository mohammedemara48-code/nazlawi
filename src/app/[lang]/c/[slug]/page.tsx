import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORIES, subsFor, type Category } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { listStores } from "@/lib/services/stores";
import { activePromotions } from "@/lib/services/promotions";
import { storeQuerySchema } from "@/lib/validation";
import StoreRow from "@/components/StoreRow";
import PromoStrip from "@/components/PromoStrip";
import Pager from "@/components/Pager";
import SortFilter from "@/components/SortFilter";
import CategoryIcon from "@/components/CategoryIcon";

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string>> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const t = dict(asLocale(lang));
  return { title: (t.categories as Record<string, [string, string]>)[slug]?.[0] ?? t.notFound };
}

/** Section page: a list of STORES, each showing its featured listings side by side. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { lang: l, slug } = await params;
  if (!CATEGORIES.includes(slug as Category)) notFound();
  const lang = asLocale(l);
  const t = dict(lang);
  const parsed = storeQuerySchema.safeParse({ ...(await searchParams), category: slug });
  const query = parsed.success ? parsed.data : storeQuerySchema.parse({ category: slug });
  const [res, promos] = await Promise.all([listStores(query), activePromotions({ category: slug })]);
  const base = href(lang, `/c/${slug}`);
  const mk = (o: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") u.set(k, String(v));
    const s = u.toString();
    return base + (s ? `?${s}` : "");
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <CategoryIcon name={slug} className="h-10 w-10 text-[#C0532F]" />
        <div>
          <h1 className="font-serif text-3xl font-bold">{t.categories[slug as Category][0]}</h1>
          {t.categories[slug as Category][1] && <p className="text-stone-600">{t.categories[slug as Category][1]}</p>}
        </div>
      </div>
      <PromoStrip items={promos} lang={lang} />
      {subsFor(slug).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" data-testid="sub-tabs">
          {[undefined, ...subsFor(slug)].map((s) => (
            <Link key={s ?? "all"} role="tab" aria-selected={query.subcategory === s} href={mk({ subcategory: s, sort: query.sort === "newest" ? undefined : query.sort, minPrice: query.minPrice, maxPrice: query.maxPrice })}
              className={`shrink-0 ${query.subcategory === s ? "btn-primary" : "btn-outline"}`}>{s ? t.subs[s] : t.all}</Link>
          ))}
        </div>
      )}
      <SortFilter lang={lang} action={base} values={query} keep={{ subcategory: query.subcategory }} />
      <p className="text-sm text-stone-500" aria-live="polite">{res.total} {t.stores}</p>
      {res.items.length ? <div className="space-y-4">{res.items.map((s) => <StoreRow key={s.id} s={s} lang={lang} />)}</div>
        : <p className="card p-8 text-center text-stone-500">{t.empty}</p>}
      <Pager lang={lang} page={res.page} totalPages={res.totalPages} pageHref={(p) => mk({ subcategory: query.subcategory, sort: query.sort === "newest" ? undefined : query.sort, minPrice: query.minPrice, maxPrice: query.maxPrice, page: p })} />
    </div>
  );
}
