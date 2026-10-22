import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
export default function AdminNav({ lang, active }: { lang: Locale; active: "listings" | "stores" | "trash" | "videos" | "promotions" | "users" | "audit" }) {
  const t = dict(lang);
  const items = [["listings", "/admin", t.listings], ["stores", "/admin/stores", t.stores], ["videos", "/admin/videos", t.videos], ["promotions", "/admin/promotions", t.promotions], ["users", "/admin/users", t.users], ["audit", "/admin/audit", t.auditLog]] as const;
  return (
    <nav className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
      {items.map(([k, p, label]) => (
        <Link key={k} href={href(lang, p)} className={k === active ? "btn-primary" : "btn-outline"}>{label}</Link>
      ))}
    </nav>
  );
}
