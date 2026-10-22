import type { Metadata } from "next";
import VideoView from "@/components/VideoView";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AVAILABILITY_CATEGORIES, type Category } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { getListing } from "@/lib/services/listings";
import { ApiError } from "@/lib/errors";
import PriceTag from "@/components/PriceTag";

type Props = { params: Promise<{ lang: string; id: string }> };
export const dynamic = "force-dynamic";

async function load(id: string) {
  try { return await getListing(id, await getServerSession()); }
  catch (e) { if (e instanceof ApiError) return null; throw e; }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  const p = await load(id);
  const t = dict(asLocale(lang));
  if (!p) return { title: t.notFound };
  return { title: lang === "en" ? p.nameEn : p.nameAr, description: lang === "en" ? p.descEn : p.descAr };
}
const waLink = (n: string) => `https://wa.me/${n.replace(/^\+/, "").replace(/^0/, "20")}`;

export default async function ProviderPage({ params }: Props) {
  const { lang: l, id } = await params;
  const lang = asLocale(l);
  const t = dict(lang);
  const p = await load(id);
  if (!p) notFound();
  const name = lang === "en" ? p.nameEn : p.nameAr;
  const desc = lang === "en" ? p.descEn : p.descAr;
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={href(lang, `/c/${p.category}`)} className="text-[#C0532F]">← {t.categories[p.category as Category][0]}</Link>
        {p.store && <Link href={href(lang, `/s/${p.store.slug}`)} className="font-semibold text-[#C0532F]">🏪 {lang === "en" ? p.store.nameEn : p.store.nameAr}</Link>}
      </div>
      {p.video && (
        <div className="card overflow-hidden">
          <VideoView v={p.video} lang={lang} />
          {p.video.status !== "APPROVED" && <p className="p-2 text-xs text-amber-800">{t.video}: {t.videoStatus[p.video.status]}</p>}
        </div>
      )}
      {p.images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.images.map((img, i) => (
            <img key={img.id} src={`/api/uploads/${img.key}`} alt={`${name} ${i + 1}`} width={img.width} height={img.height}
              className={`w-full rounded-2xl object-cover ${i === 0 ? "aspect-[16/9] sm:col-span-2" : "aspect-[4/3]"}`} />
          ))}
        </div>
      )}
      <div className="card space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-3xl font-bold">{name}</h1>
          {p.isExample && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{t.example}</span>}
          {AVAILABILITY_CATEGORIES.includes(p.category) && (
            <span className={`rounded-full px-2 py-1 text-xs ${p.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>{p.available ? t.available : t.unavailable}</span>
          )}
        </div>
        <PriceTag p={p} lang={lang} size="lg" />
        {p.subcategory && <p className="text-sm font-medium text-[#C0532F]">{t.subs[p.subcategory]}</p>}
        {desc && <p className="leading-8 text-stone-700">{desc}</p>}
        <p className="text-stone-500" dir="ltr">{p.phone}</p>
        <div className="flex gap-2">
          <a href={`tel:${p.phone}`} className="btn-primary flex-1">📞 {t.call}</a>
          <a href={waLink(p.whatsapp || p.phone)} target="_blank" rel="noopener noreferrer" className="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700">💬 {t.whatsapp}</a>
        </div>
      </div>
    </article>
  );
}
