import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { href } from "@/lib/i18n";
export function StatusTabs({ lang, base, statuses, active, labels }: { lang: Locale; base: string; statuses: readonly string[]; active: string; labels: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((st) => <Link key={st} href={href(lang, `${base}?status=${st}`)} className={st === active ? "btn-primary" : "btn-outline"}>{labels[st]}</Link>)}
    </div>
  );
}
