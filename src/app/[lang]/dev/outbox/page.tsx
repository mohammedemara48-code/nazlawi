import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLocale, dict } from "@/lib/i18n";
import { readOutbox } from "@/lib/mailer";
type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).outbox, robots: { index: false } };
}
/** Development-only view of emails written by the outbox mailer. */
export default async function Outbox({ params }: Props) {
  if (process.env.NODE_ENV === "production" || process.env.SMTP_HOST) notFound();
  const t = dict(asLocale((await params).lang));
  const mails = await readOutbox();
  const linkify = (s: string) => s.split(/(https?:\/\/\S+)/g).map((p, i) => (/^https?:/.test(p) ? <a key={i} href={p} className="break-all text-[#C0532F] underline">{p}</a> : p));
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold">{t.outbox}</h1>
      {!mails.length && <p className="card p-6 text-stone-500">{t.outboxEmpty}</p>}
      {mails.map((m, i) => (
        <article key={i} className="card p-4">
          <p className="text-xs text-stone-500" dir="ltr">{m.sentAt} · {m.to}</p>
          <h2 className="font-bold">{m.subject}</h2>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{linkify(m.text)}</pre>
        </article>
      ))}
    </div>
  );
}
