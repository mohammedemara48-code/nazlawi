import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROMOTION_STATUSES } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { adminListPromotions } from "@/lib/services/promotions";
import AdminNav from "@/components/AdminNav";
import ModerationButtons from "@/components/ModerationButtons";
import Pager from "@/components/Pager";
import { StatusTabs } from "../_shared";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ status?: string; page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).promotions };
}
export default async function AdminPromotions({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const sp = await searchParams;
  const status = (PROMOTION_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "PENDING";
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await adminListPromotions(status, page, 20);
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium", timeZone: "Africa/Cairo" });
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="promotions" />
      <StatusTabs lang={lang} base="/admin/promotions" statuses={PROMOTION_STATUSES} active={status} labels={t.promoStatus} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>{[t.promoTarget, t.store, t.startsAt, t.endsAt, t.priority, t.email, ""].map((h, i) => <th key={i} className="p-3 text-start font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {res.items.map((p) => (
              <tr key={p.id} className="border-t border-stone-100 align-top">
                <td className="p-3 font-medium">{p.listing ? (lang === "en" ? p.listing.nameEn : p.listing.nameAr) : `🏪 ${t.promoStore}`}{p.isExample ? <span className="ms-1 text-xs text-amber-700">({t.example})</span> : null}
                  {p.note && <p className="text-xs text-stone-500">{p.note}</p>}</td>
                <td className="p-3">{lang === "en" ? p.store.nameEn : p.store.nameAr}</td>
                <td className="p-3 whitespace-nowrap">{fmt.format(p.startsAt)}</td>
                <td className="p-3 whitespace-nowrap">{fmt.format(p.endsAt)}</td>
                <td className="p-3">{p.priority}</td>
                <td className="p-3" dir="ltr">{p.requestedBy?.email ?? "—"}</td>
                <td className="p-3">
                  <ModerationButtons lang={lang} url={`/api/admin/promotions/${p.id}`} actions={[
                    ...(p.status !== "APPROVED" && p.status !== "EXPIRED" ? [{ label: t.approve, body: { status: "APPROVED" } }] : []),
                    ...(p.status === "PENDING" ? [{ label: t.reject, body: { status: "REJECTED" }, tone: "danger" as const }] : []),
                    ...(p.status === "APPROVED" ? [{ label: `${t.priority} +10`, body: { priority: p.priority + 10 } }, { label: t.expire, body: { status: "EXPIRED" }, tone: "danger" as const }] : []),
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!res.items.length && <p className="p-8 text-center text-stone-500">{t.empty}</p>}
      </div>
      <Pager lang={lang} page={res.page} totalPages={res.totalPages} pageHref={(p) => href(lang, `/admin/promotions?status=${status}&page=${p}`)} />
    </div>
  );
}
