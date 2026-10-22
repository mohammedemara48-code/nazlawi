import { emailDeliveryEnabled } from "@/lib/mailer";
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
import ResendVerification from "@/components/ResendVerification";
import PromotionPanel from "@/components/PromotionPanel";
import { StoreLogo } from "@/components/StoreRow";
import StoreInfoPanel from "@/components/merchant/StoreInfoPanel";
import ProductsTab from "@/components/merchant/ProductsTab";
import SectionsTab from "@/components/merchant/SectionsTab";
import { listProducts, listSections } from "@/lib/services/catalog";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ page?: string; tab?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).dashboard };
}
const TABS = { products: { ar: "المنتجات", en: "Products" }, sections: { ar: "الأقسام", en: "Sections" }, info: { ar: "بيانات المتجر", en: "Store info" } } as const;
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
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const tab = sp.tab === "sections" || sp.tab === "info" ? sp.tab : "products";
  const [res, promos] = store ? await Promise.all([listListings({ storeId: store.id, page, pageSize: 50 }), myPromotions(s.sub)]) : [null, []];
  const name = store ? (lang === "en" ? store.nameEn : store.nameAr) : "";
  const [products, sections] = store ? await Promise.all([listProducts(store.id, s), listSections(store.id, s)]) : [null, null];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">{t.dashboard}</h1>
          <p className="text-stone-600">{s.name}</p>
        </div>
      </div>
      {!user?.emailVerified && (
        <div className="card flex flex-col gap-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{emailDeliveryEnabled() ? t.notVerified : t.notVerifiedNoEmail}</p>
          {emailDeliveryEnabled() && <ResendVerification lang={lang} />}
        </div>
      )}
      {!isProvider && <p className="card p-6 text-stone-600">{t.residentNote}</p>}
      {isProvider && !store && user?.emailVerified && <Link href={href(lang, "/onboarding")} className="btn-primary">{t.onboardingTitle}</Link>}
      {store && res && (
        <>
          <section className="card flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <StoreLogo k={store.logoKey} name={name} size="h-12 w-12" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{name}</h2>
                <p className="text-xs text-stone-500">{t.categories[store.category as Category][0]}{" "}<span className={`rounded-full px-2 py-0.5 ${badge[store.status]}`}>{t.status[store.status]}</span></p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              <Link href={href(lang, `/s/${store.slug}`)} className="btn-outline text-sm">{t.visitStore}</Link>
              <Link href={href(lang, "/dashboard?tab=info")} className="btn-outline text-sm" data-testid="edit-store-link">{t.editStore}</Link>
            </div>
          </section>
          {tab !== "info" && (!store.logoKey || !store.coverKey) && (
            <Link href={href(lang, "/dashboard?tab=info")} className="card flex items-center gap-3 border-dashed p-3 text-sm text-stone-700 hover:border-[#C0532F]">
              <span className="text-2xl" aria-hidden>🖼️</span>
              <span className="flex-1">{lang === "en" ? "Add your store logo and cover photo so customers recognize you." : "ضيف شعار متجرك وصورة الغلاف علشان الزباين يعرفوك."}</span>
              <span className="font-semibold text-[#C0532F]">{lang === "en" ? "Add" : "إضافة"} ←</span>
            </Link>
          )}
          {store.status !== "APPROVED" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.storePending}</p>}
          <nav role="tablist" aria-label={lang === "en" ? "My store" : "متجري"} className="sticky top-0 z-30 -mx-4 flex gap-1 bg-[#FBF3EA]/95 px-4 py-2 backdrop-blur">
            {(["products", "sections", "info"] as const).map((k) => (
              <Link key={k} role="tab" aria-selected={tab === k} href={href(lang, `/dashboard?tab=${k}`)} scroll={false}
                className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold ${tab === k ? "bg-[#C0532F] text-white shadow" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
                {TABS[k][lang]}
              </Link>
            ))}
          </nav>
          {tab === "products" && <ProductsTab lang={lang} storeId={store.id} initialProducts={products!} initialSections={sections!} />}
          {tab === "sections" && <SectionsTab lang={lang} storeId={store.id} initial={sections!} />}
          {tab === "info" && (
            <>
              <StoreInfoPanel lang={lang} store={store} />
              <PromotionPanel lang={lang} storeId={store.id} listings={res.items.filter((i) => i.status === "APPROVED")} promos={promos} />
            </>
          )}
        </>
      )}
    </div>
  );
}
