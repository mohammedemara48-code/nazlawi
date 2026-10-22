import type { Metadata } from "next";
import VideoView from "@/components/VideoView";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Category } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { storePage } from "@/lib/services/stores";
import { storePageQuerySchema } from "@/lib/validation";
import { ApiError } from "@/lib/errors";
import ListingCard, { waLink } from "@/components/ListingCard";
import { StoreLogo } from "@/components/StoreRow";
import Pager from "@/components/Pager";
import SortFilter from "@/components/SortFilter";

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string>> };
export const dynamic = "force-dynamic";

async function load(slug: string, sp: Record<string, string>) {
  const parsed = storePageQuerySchema.safeParse(sp);
  try { return await storePage(slug, await getServerSession(), parsed.success ? parsed.data : storePageQuerySchema.parse({})); }
  catch (e) { if (e instanceof ApiError) return null; throw e; }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const d = await load(slug, {});
  if (!d) return { title: dict(asLocale(lang)).notFound };
  return { title: lang === "en" ? d.store.nameEn : d.store.nameAr, description: lang === "en" ? d.store.bioEn : d.store.bioAr };
}

export default async function StorePage({ params, searchParams }: Props) {
  const { lang: l, slug } = await params;
  const lang = asLocale(l);
  const t = dict(lang);
  const sp = await searchParams;
  const d = await load(slug, sp);
  if (!d) notFound();
  const { store, video, groups, featured, listings } = d;
  const name = lang === "en" ? store.nameEn : store.nameAr;
  const bio = lang === "en" ? store.bioEn : store.bioAr;
  const address = lang === "en" ? store.addressEn : store.addressAr;
  const base = href(lang, `/s/${slug}`);
  const active = sp.group;
  const qp = storePageQuerySchema.safeParse(sp);
  const q = qp.success ? qp.data : storePageQuerySchema.parse({});
  return (
    <div className="space-y-6">
      {!d.public && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.storePending}</p>}
      <header className="card overflow-hidden">
        <div className="h-40 bg-gradient-to-l from-[#F2D49B] to-[#E8955F] bg-cover bg-center sm:h-56" style={store.coverKey ? { backgroundImage: `url(/api/uploads/${store.coverKey})` } : undefined} />
        <div className="space-y-3 p-5">
          <div className="-mt-14 flex items-end gap-3">
            <span className="rounded-2xl border-4 border-white bg-white shadow"><StoreLogo k={store.logoKey} name={name} size="h-20 w-20" /></span>
            <div className="pb-1">
              <h1 className="font-serif text-3xl font-bold">{name}</h1>
              <Link href={href(lang, `/c/${store.category}`)} className="text-sm text-[#C0532F]">{t.categories[store.category as Category][0]}{store.subcategory ? ` · ${t.subs[store.subcategory]}` : ""}</Link>
            </div>
            {store.isExample && <span className="mb-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{t.example}</span>}
          </div>
          {bio && <p className="leading-8 text-stone-700">{bio}</p>}
          {(address || store.area) && <p className="text-sm text-stone-500">📍 {[address, store.area].filter(Boolean).join(" · ")}</p>}
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${store.phone}`} className="btn-primary">📞 {t.call}</a>
            <a href={waLink(store.whatsapp || store.phone)} target="_blank" rel="noopener noreferrer" className="btn bg-emerald-600 text-white hover:bg-emerald-700">💬 {t.whatsapp}</a>
          </div>
        </div>
      </header>
      {video && (
        <section className="card overflow-hidden">
          <VideoView v={video} lang={lang} />
          {video.status !== "APPROVED" && <p className="p-2 text-xs text-amber-800">{t.video}: {t.videoStatus[video.status]}</p>}
        </section>
      )}
      {featured.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">★ {t.featured}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map((p) => <ListingCard key={p.id} p={p} lang={lang} />)}</div>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{featured.length ? t.moreListings : t.allListings}</h2>
        {groups.length > 0 && (
          <nav className="flex flex-wrap gap-2" role="tablist">
            <Link role="tab" aria-selected={!active} href={base} className={!active ? "btn-primary" : "btn-outline"}>{t.all}</Link>
            {groups.map((g) => (
              <Link key={g.id} role="tab" aria-selected={active === g.id} href={`${base}?group=${g.id}`} className={active === g.id ? "btn-primary" : "btn-outline"}>
                {lang === "en" ? g.nameEn : g.nameAr} <span className="text-xs opacity-70">({g.count})</span>
              </Link>
            ))}
          </nav>
        )}
        <SortFilter lang={lang} action={base} values={q} keep={{ group: active ?? undefined }} />
        {listings.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.items.map((p) => <ListingCard key={p.id} p={p} lang={lang} />)}</div>
          : featured.length ? null : <p className="card p-8 text-center text-stone-500">{t.empty}</p>}
        <Pager lang={lang} page={listings.page} totalPages={listings.totalPages} pageHref={(p) => `${base}?${new URLSearchParams({ ...(active ? { group: active } : {}), ...(q.sort !== "newest" ? { sort: q.sort } : {}), ...(q.minPrice != null ? { minPrice: String(q.minPrice) } : {}), ...(q.maxPrice != null ? { maxPrice: String(q.maxPrice) } : {}), page: String(p) })}`} />
      </section>
    </div>
  );
}
