import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { getMyStore } from "@/lib/services/stores";
import StoreForm from "@/components/StoreForm";

type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).onboardingTitle };
}
/** Providers without a store land here and must create one (section required). */
export default async function Onboarding({ params }: Props) {
  const lang = asLocale((await params).lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login"));
  if (s.role === "ADMIN") redirect(href(lang, "/admin")); // admins never own a store
  if (s.role === "RESIDENT") redirect(href(lang, "/dashboard"));
  if (await getMyStore(s.sub)) redirect(href(lang, "/dashboard"));
  return <StoreForm lang={lang} />;
}
