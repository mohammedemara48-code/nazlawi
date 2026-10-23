import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listReports } from "@/lib/services/posts";
import AdminNav from "@/components/AdminNav";
import ReportActions from "@/components/invitations/ReportActions";

type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).reports.title };
}
/** Reported invitation posts/comments: delete permanently or dismiss the reports. */
export default async function AdminReports({ params }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const groups = await listReports();
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="reports" />
      {groups.length === 0 ? <p className="card p-8 text-center text-stone-500">{t.reports.none}</p> : (
        <ul className="space-y-3" data-testid="reports">
          {groups.map((g) => {
            const author = g.post?.author ?? g.comment?.author;
            const target = g.post ? { postId: g.post.id } : { commentId: g.comment!.id };
            return (
              <li key={g.key} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{t.reports.count(g.reports.length)}</span>
                  <span className="font-semibold">{g.type === "POST" ? t.reports.post : t.reports.comment}</span>
                  {author && <span className="text-stone-500">{t.reports.by} {author.name} ({author.email})</span>}
                </div>
                {g.post && (
                  <div className="flex gap-3">
                    <img src={`/api/uploads/${g.post.imageKey}`} alt="" className="h-24 w-24 rounded-xl object-cover" />
                    <p className="whitespace-pre-line text-sm">{g.post.caption}</p>
                  </div>
                )}
                {g.comment && <p className="rounded-xl bg-stone-100 p-2 text-sm">{g.comment.body} <Link className="text-xs text-[#C0532F]" href={href(lang, "/invitations")}>↗</Link></p>}
                <ul className="text-xs text-stone-500">{g.reports.map((r) => <li key={r.id}>• {r.reporter.name}{r.reason ? `: ${r.reason}` : ""}</li>)}</ul>
                <ReportActions lang={lang} target={target} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
