import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n";
import { privacyDoc } from "@/lib/legal";
import LegalDoc from "@/components/LegalDoc";
type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = privacyDoc(asLocale((await params).lang));
  return { title: d.title, description: d.intro, alternates: { languages: { ar: "/privacy", en: "/en/privacy" } } };
}
export default async function Page({ params }: Props) {
  return <LegalDoc doc={privacyDoc(asLocale((await params).lang))} />;
}
