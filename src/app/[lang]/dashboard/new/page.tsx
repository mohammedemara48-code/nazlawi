import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { getMyStore } from "@/lib/services/stores";
import ListingForm from "@/components/ListingForm";
type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).addListing };
}
export default async function Page({ params }: Props) {
  const lang = asLocale((await params).lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login"));
  const store = await getMyStore(s.sub);
  if (!store) redirect(href(lang, "/onboarding"));
  return <ListingForm lang={lang} groups={store.groups} />;
}
