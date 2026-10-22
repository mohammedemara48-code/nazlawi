import type { Metadata } from "next";
import { asLocale, dict } from "@/lib/i18n";
type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).privacy };
}
export default async function Page({ params }: Props) {
  const t = dict(asLocale((await params).lang));
  return (
    <article className="card mx-auto max-w-2xl p-8">
      <h1 className="font-serif text-3xl font-bold">{t.privacy}</h1>
      <p className="mt-4 leading-8 text-stone-700">{t.privacyBody}</p>
    </article>
  );
}
