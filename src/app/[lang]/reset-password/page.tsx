import type { Metadata } from "next";
import Link from "next/link";
import { asLocale, dict, href } from "@/lib/i18n";
import SimpleForm from "@/components/SimpleForm";
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ token?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).resetTitle };
}
export default async function Page({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const token = (await searchParams).token ?? "";
  return (
    <div className="space-y-4">
      <SimpleForm lang={lang} endpoint="/api/auth/reset-password" title={t.resetTitle} extra={{ token }}
        fields={[{ name: "password", label: t.newPassword, type: "password" }]} submitLabel={t.save} successText={t.resetDone} />
      <p className="text-center text-sm"><Link className="text-[#C0532F]" href={href(lang, "/login")}>{t.login}</Link></p>
    </div>
  );
}
