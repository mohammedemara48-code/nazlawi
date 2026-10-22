import type { Metadata } from "next";
import { asLocale } from "@/lib/i18n";
import { termsDoc } from "@/lib/legal";
import LegalDoc from "@/components/LegalDoc";
type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = termsDoc(asLocale((await params).lang));
  return { title: d.title, description: d.intro, alternates: { languages: { ar: "/terms", en: "/en/terms" } } };
}
export default async function Page({ params }: Props) {
  return <LegalDoc doc={termsDoc(asLocale((await params).lang))} />;
}
