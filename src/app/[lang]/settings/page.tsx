import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { getAccount } from "@/lib/services/account";
import SettingsForms from "@/components/SettingsForms";

type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).settings };
}
export default async function Settings({ params }: Props) {
  const lang = asLocale((await params).lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login?next=" + encodeURIComponent(href(lang, "/settings"))));
  const a = await getAccount(s.sub);
  if (!a) redirect(href(lang, "/login"));
  return <SettingsForms lang={lang} account={{ name: a.name, email: a.email, phone: a.phone, locale: a.locale }} />;
}
