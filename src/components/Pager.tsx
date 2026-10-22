import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
export default function Pager({ lang, page, totalPages, pageHref }: { lang: Locale; page: number; totalPages: number; pageHref: (p: number) => string }) {
  const t = dict(lang);
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 && <Link className="btn-outline" href={pageHref(page - 1)}>{t.prev}</Link>}
      <span>{t.page(page, totalPages)}</span>
      {page < totalPages && <Link className="btn-outline" href={pageHref(page + 1)}>{t.next}</Link>}
    </nav>
  );
}
