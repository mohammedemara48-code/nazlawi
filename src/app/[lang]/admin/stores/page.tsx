import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUSES, type Category } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { adminListStores } from "@/lib/services/stores";
import AdminNav from "@/components/AdminNav";
import ModerationButtons from "@/components/ModerationButtons";
import Pager from "@/components/Pager";
import { StoreLogo } from "@/components/StoreRow";
import { StatusTabs } from "../_shared";
import AdminAction from "@/components/AdminAction";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ status?: string; page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).stores };
}
export default async function AdminStores({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "PENDING";
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await adminListStores(status, page, 20);
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="stores" />
      <StatusTabs lang={lang} base="/admin/stores" statuses={STATUSES} active={status} labels={t.status} />
      <p className="text-sm text-stone-500">{res.total} {t.stores}</p>
      <ul className="space-y-3">
        {res.items.map((st) => (
          <li key={st.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <StoreLogo k={st.logoKey} name={st.nameAr} />
              <div>
                <Link href={href(lang, `/s/${st.slug}`)} className="font-bold hover:text-[#C0532F]">{lang === "en" ? st.nameEn : st.nameAr}</Link>
                <p className="text-sm text-stone-500">{t.categories[st.category as Category][0]} · <span dir="ltr">{st.owner.email}</span> · {t.results(st._count.listings)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModerationButtons lang={lang} url={`/api/admin/stores/${st.id}/status`} actions={[{ label: t.approve, body: { status: "APPROVED" } }, { label: t.hide, body: { status: "HIDDEN" } }]} />
              <AdminAction lang={lang} kind="store" id={st.id} action="delete" />
              {st.owner.role === "ADMIN" && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{lang === "en" ? "Owned by an admin" : "مملوك لحساب إدارة"}</span>}
            </div>
          </li>
        ))}
      </ul>
      {!res.items.length && <p className="card p-8 text-center text-stone-500">{t.empty}</p>}
      <Pager lang={lang} page={res.page} totalPages={res.totalPages} pageHref={(p) => href(lang, `/admin/stores?status=${status}&page=${p}`)} />
    </div>
  );
}
