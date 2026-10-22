import type { Metadata } from "next";
import { asLocale, dict } from "@/lib/i18n";
import SimpleForm from "@/components/SimpleForm";
import { emailDeliveryEnabled } from "@/lib/mailer";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).forgotTitle };
}
export default async function Page({ params }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  // Be honest: without an email provider no reset link can be delivered.
  if (!emailDeliveryEnabled() && (process.env.NODE_ENV === "production" || process.env.VERCEL)) {
    return (
      <section className="card mx-auto max-w-md space-y-3 p-6" data-testid="forgot-unavailable">
        <h1 className="font-serif text-2xl font-bold">{t.forgotTitle}</h1>
        <p className="text-stone-700">{lang === "en"
          ? "Password reset by email isn't available yet. Please contact us through the Contact page and we'll help you regain access."
          : "استعادة كلمة المرور بالبريد مش متاحة حالياً. تواصل معانا من صفحة «تواصل معنا» وهنساعدك ترجع لحسابك."}</p>
      </section>
    );
  }
  return <SimpleForm lang={lang} endpoint="/api/auth/forgot-password" title={t.forgotTitle} sub={t.forgotSub}
    fields={[{ name: "email", label: t.email, type: "email" }]} submitLabel={t.sendLink} successText={t.forgotSent} />;
}
