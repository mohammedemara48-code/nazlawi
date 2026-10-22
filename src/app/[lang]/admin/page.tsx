import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUSES, type Status } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listListings } from "@/lib/services/listings";
import ListingTable from "@/components/ListingTable";
import AdminNav from "@/components/AdminNav";
import DemoStorePanel from "@/components/DemoStorePanel";
import { prisma } from "@/lib/db";
import { DEMO_SLUG } from "@/lib/services/demo";
import { adminOwnedStores } from "@/lib/services/trash";
import AdminAction from "@/components/AdminAction";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ status?: string; page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).admin };
}
export default async function Admin({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Status) : "APPROVED"; // products publish immediately; admins review live items and hide if needed
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await listListings({ status, page, pageSize: 20 });
  const demo = await prisma.store.findFirst({ where: { slug: DEMO_SLUG, deletedAt: null }, select: { id: true } });
  const owned = await adminOwnedStores();
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="listings" />
      {owned.length > 0 && (
        <div className="card border-amber-300 bg-amber-50 p-4 text-sm" data-testid="admin-owned-stores">
          <p className="font-bold text-amber-900">{lang === "en" ? "Admin accounts must not own stores. These stores belong to an admin account:" : "حسابات الإدارة لا يجب أن تمتلك متاجر. المتاجر دي مملوكة لحساب إدارة:"}</p>
          <ul className="mt-2 space-y-2">
            {owned.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-2">
                <span><Link className="font-semibold underline" href={href(lang, `/s/${st.slug}`)}>{lang === "en" ? st.nameEn : st.nameAr}</Link> · <span dir="ltr">{st.owner.email}</span></span>
                <AdminAction lang={lang} kind="store" id={st.id} action="delete" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <DemoStorePanel lang={lang} exists={!!demo} slug={DEMO_SLUG} />
      <div className="flex gap-2">
        {STATUSES.map((st) => (
          <Link key={st} href={href(lang, `/admin?status=${st}`)} className={st === status ? "btn-primary" : "btn-outline"}>{t.status[st]}</Link>
        ))}
      </div>
      <p className="text-sm text-stone-500">{t.results(res.total)}</p>
      <ListingTable items={res.items} lang={lang} admin />
    </div>
  );
}
