import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import type { listStores } from "@/lib/services/stores";
import ListingCard from "./ListingCard";

type Store = Awaited<ReturnType<typeof listStores>>["items"][number];
export function StoreLogo({ k, name, size = "h-12 w-12" }: { k: string | null; name: string; size?: string }) {
  return k ? <img src={`/api/uploads/${k}`} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-[#C0532F] text-lg font-bold text-white`}>{name.slice(0, 1)}</span>;
}

/** Category page row: store name (+logo) and its featured listings side by side. */
export default function StoreRow({ s, lang }: { s: Store; lang: Locale }) {
  const t = dict(lang);
  const name = lang === "en" ? s.nameEn : s.nameAr;
  return (
    <article className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href={href(lang, `/s/${s.slug}`)} className="flex min-w-0 items-center gap-3 hover:text-[#C0532F]">
          <StoreLogo k={s.logoKey} name={name} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{name}</h2>
            <p className="truncate text-xs text-stone-500">{[s.area, t.results(s.listingCount)].filter(Boolean).join(" · ")}</p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {s.isExample && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{t.example}</span>}
          <Link href={href(lang, `/s/${s.slug}`)} className="btn-outline text-sm">{t.visitStore}</Link>
        </div>
      </div>
      {s.featured.length ? (
        <div className="flex gap-3 overflow-x-auto pb-1">{s.featured.map((l) => <ListingCard key={l.id} p={l} lang={lang} compact />)}</div>
      ) : <p className="text-sm text-stone-400">{t.noFeatured}</p>}
    </article>
  );
}
