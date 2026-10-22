import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Category } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listListings } from "@/lib/services/listings";
import { getMyStore } from "@/lib/services/stores";
import { myPromotions } from "@/lib/services/promotions";
import { prisma } from "@/lib/db";
import ListingTable from "@/components/ListingTable";
import ResendVerification from "@/components/ResendVerification";
import FeaturedPicker from "@/components/FeaturedPicker";
import GroupManager from "@/components/GroupManager";
import PromotionPanel from "@/components/PromotionPanel";
import { StoreLogo } from "@/components/StoreRow";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).dashboard };
}
const badge: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800", HIDDEN: "bg-stone-200 text-stone-600" };

export default async function Dashboard({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login"));
  const user = await prisma.user.findUnique({ where: { id: s.sub }, select: { emailVerified: true } });
  const isProvider = s.role === "PROVIDER" || s.role === "ADMIN";
  const store = isProvider ? await getMyStore(s.sub) : null;
  // Providers must create their store (and pick a section) before anything else.
  if (s.role === "PROVIDER" && !store && user?.emailVerified) redirect(href(lang, "/onboarding"));
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [res, promos] = store ? await Promise.all([listListings({ storeId: store.id, page, pageSize: 50 }), myPromotions(s.sub)]) : [null, []];
  const name = store ? (lang === "en" ? store.nameEn : store.nameAr) : "";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">{t.dashboard}</h1>
          <p className="text-stone-600">{s.name}</p>
        </div>
        {store && <Link href={href(lang, "/dashboard/new")} className="btn-primary">+ {t.addListing}</Link>}
      </div>
      {!user?.emailVerified && (
        <div className="card flex flex-col gap-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.notVerified}</p>
          <ResendVerification lang={lang} />
        </div>
      )}
      {!isProvider && <p className="card p-6 text-stone-600">{t.residentNote}</p>}
      {isProvider && !store && user?.emailVerified && <Link href={href(lang, "/onboarding")} className="btn-primary">{t.onboardingTitle}</Link>}
      {store && res && (
        <>
          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <StoreLogo k={store.logoKey} name={name} size="h-14 w-14" />
              <div>
                <p className="text-xs text-stone-500">{t.myStore}</p>
                <h2 className="text-xl font-bold">{name}</h2>
                <p className="text-sm text-stone-500">{t.categories[store.category as Category][0]}{store.subcategory ? ` · ${t.subs[store.subcategory]}` : ""}
                  {" "}<span className={`rounded-full px-2 py-0.5 text-xs ${badge[store.status]}`}>{t.status[store.status]}</span></p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={href(lang, `/s/${store.slug}`)} className="btn-outline">{t.visitStore}</Link>
              <Link href={href(lang, "/dashboard/store")} className="btn-outline">{t.editStore}</Link>
            </div>
          </section>
          {store.status !== "APPROVED" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.storePending}</p>}
          <FeaturedPicker lang={lang} storeId={store.id} items={res.items.map((i) => ({ id: i.id, nameAr: i.nameAr, nameEn: i.nameEn, status: i.status, featuredPosition: i.featuredPosition }))} />
          <GroupManager lang={lang} storeId={store.id} groups={store.groups} />
          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t.myListings}</h2>
            <p className="text-sm text-stone-500">{t.pendingNote}</p>
            <ListingTable items={res.items} lang={lang} />
          </section>
          <PromotionPanel lang={lang} storeId={store.id} listings={res.items.filter((i) => i.status === "APPROVED")} promos={promos} />
        </>
      )}
    </div>
  );
}
