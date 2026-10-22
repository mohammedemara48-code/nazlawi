import type { Metadata } from "next";
import { asLocale, dict, href } from "@/lib/i18n";
import { listPublic } from "@/lib/services/listings";
import { listStores } from "@/lib/services/stores";
import StoreRow from "@/components/StoreRow";
import ListingCard from "@/components/ListingCard";
import Pager from "@/components/Pager";
import SortFilter from "@/components/SortFilter";
import { listQuerySchema } from "@/lib/validation";
import SearchBar from "@/components/SearchBar";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string>> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).searchTitle };
}
export default async function SearchPage({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const parsed = listQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});
  const empty = { items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 };
  const [res, stores] = query.q ? await Promise.all([listPublic(query), listStores({ q: query.q, page: 1, pageSize: 5 })]) : [empty, { ...empty, items: [] as Awaited<ReturnType<typeof listStores>>["items"] }];
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.searchTitle}</h1>
      <SearchBar lang={lang} q={query.q} />
      {stores.items.length > 0 && query.page === 1 && (
        <section className="space-y-3"><h2 className="text-xl font-bold">{t.stores}</h2>{stores.items.map((s) => <StoreRow key={s.id} s={s} lang={lang} />)}</section>
      )}
      {query.q && <SortFilter lang={lang} action={href(lang, "/search")} values={query} keep={{ q: query.q }} />}
      {query.q && <p className="text-sm text-stone-500" aria-live="polite">{t.results(res.total)}</p>}
      {res.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{res.items.map((p) => <ListingCard key={p.id} p={p} lang={lang} />)}</div>
        : query.q && !stores.items.length ? <p className="card p-8 text-center text-stone-500">{t.empty}</p> : null}
      <Pager lang={lang} page={res.page} totalPages={res.totalPages} pageHref={(p) => href(lang, `/search?${new URLSearchParams({ q: query.q ?? "", sort: query.sort, ...(query.minPrice != null ? { minPrice: String(query.minPrice) } : {}), ...(query.maxPrice != null ? { maxPrice: String(query.maxPrice) } : {}), page: String(p) })}`)} />
    </div>
  );
}
