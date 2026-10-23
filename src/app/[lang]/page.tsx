import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { storeCounts } from "@/lib/services/stores";
import { activePromotions } from "@/lib/services/promotions";
import PromoStrip from "@/components/PromoStrip";
import SearchBar from "@/components/SearchBar";
import CategoryIcon from "@/components/CategoryIcon";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const [counts, promos] = await Promise.all([storeCounts(), activePromotions()]);
  return (
    <div className="-mt-6 w-screen bg-cover bg-center px-4 pb-10 pt-6 [margin-inline:calc(50%-50vw)]" style={{ backgroundImage: "linear-gradient(rgba(251,243,234,.35),rgba(251,243,234,.95) 70%),url(/village-hero.jpg)" }}>
      <section className="mx-auto max-w-3xl rounded-[2rem] bg-[#F2D49B]/95 px-6 py-12 text-center shadow-lg sm:py-16">
        <h1 className="font-serif text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">{t.tagline}</h1>
        <p className="mt-4 text-stone-700">{t.heroSub}</p>
      </section>
      <div className="mx-auto mt-6 max-w-3xl"><SearchBar lang={lang} /></div>
      <div className="mt-5" data-testid="home-promos"><PromoStrip items={promos} lang={lang} /></div>
      <section className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Link key={c} href={href(lang, `/c/${c}`)} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <CategoryIcon name={c} className="h-8 w-8 text-[#C0532F]" />
            <h2 className="mt-3 text-lg font-bold">{t.categories[c][0]}</h2>
            <p className="text-sm text-stone-600">{t.categories[c][1]}</p>
            <p className="mt-2 text-xs text-stone-400">{counts[c] ?? 0} {t.stores}</p>
          </Link>
        ))}
      </section>
      <p className="mt-6 text-center text-xs text-stone-500">{t.demoNote}</p>
    </div>
  );
}
