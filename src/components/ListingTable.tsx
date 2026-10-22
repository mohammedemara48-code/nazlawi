import type { Locale } from "@/lib/constants";
import { AVAILABILITY_CATEGORIES } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import type { listListings } from "@/lib/services/listings";
import ListingActions from "./ListingActions";
import PriceTag from "./PriceTag";

type Items = Awaited<ReturnType<typeof listListings>>["items"];
const badge: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800", HIDDEN: "bg-stone-200 text-stone-600" };

export default function ListingTable({ items, lang, admin }: { items: Items; lang: Locale; admin?: boolean }) {
  const t = dict(lang);
  if (!items.length) return <p className="card p-8 text-center text-stone-500">{t.empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((p) => (
        <li key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold">{lang === "en" ? p.nameEn : p.nameAr}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badge[p.status]}`}>{t.status[p.status]}</span>
              {p.featuredPosition != null && <span className="rounded-full bg-[#C0532F]/10 px-2 py-0.5 text-xs text-[#C0532F]">★ {p.featuredPosition}</span>}
              {p.isExample && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{t.example}</span>}
            </div>
            <PriceTag p={p} lang={lang} size="xs" />
            <p className="text-sm text-stone-500">{t.categories[p.category as keyof typeof t.categories][0]}{p.subcategory ? ` · ${t.subs[p.subcategory]}` : ""} · <span dir="ltr">{p.phone}</span>{p.store ? ` · 🏪 ${lang === "en" ? p.store.nameEn : p.store.nameAr}` : ""}</p>
          </div>
          <ListingActions lang={lang} id={p.id} available={p.available} showAvailability={AVAILABILITY_CATEGORIES.includes(p.category)} admin={admin} />
        </li>
      ))}
    </ul>
  );
}
