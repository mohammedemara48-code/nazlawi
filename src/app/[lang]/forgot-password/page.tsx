import type { Metadata } from "next";
import { asLocale, dict } from "@/lib/i18n";
import SimpleForm from "@/components/SimpleForm";
type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).forgotTitle };
}
export default async function Page({ params }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  return <SimpleForm lang={lang} endpoint="/api/auth/forgot-password" title={t.forgotTitle} sub={t.forgotSub}
    fields={[{ name: "email", label: t.email, type: "email" }]} submitLabel={t.sendLink} successText={t.forgotSent} />;
}
