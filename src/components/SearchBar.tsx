import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
export default function SearchBar({ lang, q = "" }: { lang: Locale; q?: string }) {
  const t = dict(lang);
  return (
    <form action={href(lang, "/search")} method="get" role="search" className="flex gap-2">
      <input name="q" defaultValue={q} placeholder={t.searchPlaceholder} aria-label={t.search} className="input flex-1 py-3 shadow-sm" />
      <button className="btn-primary px-5">{t.search}</button>
    </form>
  );
}
