import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VideoView from "@/components/VideoView";
import type { Category } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { storeCatalog } from "@/lib/services/catalog";
import { ApiError } from "@/lib/errors";
import { StoreLogo, subLabel } from "@/components/StoreRow";
import StoreMap from "@/components/StoreMap";
import StoreCatalog from "@/components/StoreCatalog";
import { cairoMinutes, isOpenAt, waOrderLink } from "@/lib/store-hours";
import { toEgE164 } from "@/lib/validation";
import { mediaUrl } from "@/lib/services/media";
import { abs, jsonLd } from "@/lib/site";
import PromoStrip from "@/components/PromoStrip";
import { activePromotions } from "@/lib/services/promotions";

type Props = { params: Promise<{ lang: string; slug: string }> };
export const dynamic = "force-dynamic";

async function load(slug: string) {
  try { return await storeCatalog(slug, await getServerSession()); }
  catch (e) { if (e instanceof ApiError) return null; throw e; }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const d = await load(slug);
  if (!d) return { title: dict(asLocale(lang)).notFound };
  const title = lang === "en" ? d.store.nameEn : d.store.nameAr;
  const description = (lang === "en" ? d.store.bioEn : d.store.bioAr) || undefined;
  const img = mediaUrl(d.store.coverKey ?? d.store.logoKey);
  const path = `/s/${slug}`;
  return {
    title, description,
    alternates: { canonical: lang === "en" ? `/en${path}` : path, languages: { ar: path, en: `/en${path}` } },
    openGraph: { type: "website", title, description, url: lang === "en" ? `/en${path}` : path, ...(img ? { images: [{ url: img }] } : {}) },
    ...(d.public ? {} : { robots: { index: false } }),
  };
}

export default async function StorePage({ params }: Props) {
  const { lang: l, slug } = await params;
  const lang = asLocale(l);
  const en = lang === "en";
  const t = dict(lang);
  const d = await load(slug);
  if (!d) notFound();
  const { store, video, sections, products } = d;
  const promos = d.public ? await activePromotions({ storeId: store.id, limit: 10 }) : [];
  const name = en ? store.nameEn : store.nameAr;
  const bio = en ? store.bioEn : store.bioAr;
  const address = en ? store.addressEn : store.addressAr;
  const hoursNote = en ? store.hoursNoteEn || store.hoursNoteAr : store.hoursNoteAr;
  const open = isOpenAt(store.openTime, store.closeTime, cairoMinutes());
  const wa = store.whatsapp || toEgE164(store.phone);
  const hasPin = store.latitude != null && store.longitude != null;
  return (
    <div className="space-y-5">
      {d.public && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({
        "@context": "https://schema.org", "@type": "LocalBusiness",
        name: lang === "en" ? d.store.nameEn : d.store.nameAr,
        description: (lang === "en" ? d.store.bioEn : d.store.bioAr) || undefined,
        url: abs(href(lang, `/s/${d.store.slug}`)),
        image: mediaUrl(d.store.coverKey ?? d.store.logoKey) ? abs(mediaUrl(d.store.coverKey ?? d.store.logoKey)!) : undefined,
        telephone: d.store.phone || undefined,
        address: (d.store.addressAr || d.store.addressEn) ? { "@type": "PostalAddress", streetAddress: (lang === "en" ? d.store.addressEn : d.store.addressAr) || d.store.addressAr || d.store.addressEn, addressCountry: "EG" } : undefined,
        geo: d.store.latitude != null && d.store.longitude != null ? { "@type": "GeoCoordinates", latitude: d.store.latitude, longitude: d.store.longitude } : undefined,
      })} />}
      {!d.public && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.storePending}</p>}
      <header className="card overflow-hidden">
        <div className="h-32 bg-gradient-to-l from-[#F2D49B] to-[#E8955F] bg-cover bg-center sm:h-52" style={store.coverKey ? { backgroundImage: `url(/api/uploads/${store.coverKey})` } : undefined} />
        <div className="space-y-3 p-4">
          <div className="-mt-12 flex items-end gap-3">
            <span className="rounded-2xl border-4 border-white bg-white shadow"><StoreLogo k={store.logoKey} name={name} size="h-20 w-20" /></span>
            <div className="min-w-0 pb-1">
              <h1 className="truncate font-serif text-2xl font-bold sm:text-3xl">{name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={href(lang, `/c/${store.category}`)} className="text-[#C0532F]">{t.categories[store.category as Category][0]}</Link>
                {subLabel(store, lang) && <span className="rounded-full bg-[#C0532F]/10 px-2 py-0.5 text-xs font-semibold text-[#C0532F]" data-testid="store-sub">{subLabel(store, lang)}</span>}
                {open != null && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${open ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"}`}>
                    {open ? (en ? "Open now" : "مفتوح الآن") : (en ? "Closed now" : "مغلق الآن")}
                  </span>
                )}
                {store.isExample && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{en ? "Demo" : "تجريبي"}</span>}
              </div>
            </div>
          </div>
          {bio && <p className="leading-7 text-stone-700">{bio}</p>}
          {(store.openTime && store.closeTime) || hoursNote ? (
            <p className="text-sm text-stone-600">🕒 {store.openTime && store.closeTime ? <span dir="ltr">{store.openTime}–{store.closeTime}</span> : null}{hoursNote ? ` · ${hoursNote}` : ""}</p>
          ) : null}
          {(address || store.area) && <p className="text-sm text-stone-500">📍 {[address, store.area].filter(Boolean).join(" · ")}</p>}
          <div className="grid grid-cols-3 gap-2">
            <a href={`tel:${store.phone}`} className="btn-primary text-sm">📞 {t.call}</a>
            {wa ? <a href={waOrderLink(wa, `أهلاً، جاي من نزلاوي بخصوص ${store.nameAr}`)} target="_blank" rel="noopener noreferrer" className="btn bg-emerald-600 text-sm text-white hover:bg-emerald-700">💬 {t.whatsapp}</a> : <span />}
            {hasPin ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">🧭 {en ? "Directions" : "الاتجاهات"}</a> : <span />}
          </div>
        </div>
      </header>
      {video && (
        <section className="card overflow-hidden">
          <VideoView v={video} lang={lang} />
          {video.status !== "APPROVED" && <p className="p-2 text-xs text-amber-800">{t.video}: {t.videoStatus[video.status]}</p>}
        </section>
      )}
      {promos.length > 0 && <div data-testid="store-promos"><PromoStrip items={promos} lang={lang} /></div>}
      <StoreCatalog lang={lang} sections={sections} products={products} whatsapp={wa} storeName={store.nameAr} />
      {hasPin && <StoreMap lang={lang} lat={store.latitude!} lng={store.longitude!} landmark={[address, store.area].filter(Boolean).join(" · ") || undefined} />}
    </div>
  );
}
