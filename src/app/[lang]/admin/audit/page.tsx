import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listAudit } from "@/lib/services/audit";
import AdminNav from "@/components/AdminNav";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).auditLog };
}
export default async function Audit({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listAudit(page, 30);
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
  const describe = (m: Record<string, unknown>) =>
    [m.email ?? m.name, m.from && m.to ? `${String(m.from)} → ${String(m.to)}` : null].filter(Boolean).join(" · ");
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="audit" />
      {!res.items.length ? <p className="card p-8 text-center text-stone-500">{t.empty}</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>{[t.when, t.actor, t.action, t.target].map((h) => <th key={h} className="p-3 text-start font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {res.items.map((a) => (
                <tr key={a.id} className="border-t border-stone-100">
                  <td className="p-3 whitespace-nowrap">{fmt.format(a.createdAt)}</td>
                  <td className="p-3" dir="ltr">{a.actorEmail}</td>
                  <td className="p-3 font-medium">{t.actions[a.action] ?? a.action}</td>
                  <td className="p-3"><span className="text-xs text-stone-400">{a.targetType}</span> <span dir="auto">{describe(a.meta)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {res.page > 1 && <Link className="btn-outline" href={href(lang, `/admin/audit?page=${res.page - 1}`)}>{t.prev}</Link>}
          <span>{t.page(res.page, res.totalPages)}</span>
          {res.page < res.totalPages && <Link className="btn-outline" href={href(lang, `/admin/audit?page=${res.page + 1}`)}>{t.next}</Link>}
        </nav>
      )}
    </div>
  );
}
