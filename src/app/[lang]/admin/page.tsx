import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUSES, type Status } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listListings } from "@/lib/services/listings";
import ListingTable from "@/components/ListingTable";
import AdminNav from "@/components/AdminNav";

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
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Status) : "PENDING";
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await listListings({ status, page, pageSize: 20 });
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="listings" />
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
