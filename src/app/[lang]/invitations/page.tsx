import Link from "next/link";
import type { Metadata } from "next";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { canPost, listPosts } from "@/lib/services/posts";
import CategoryIcon from "@/components/CategoryIcon";
import Pager from "@/components/Pager";
import PostComposer from "@/components/invitations/PostComposer";
import PostCard from "@/components/invitations/PostCard";
import { toView } from "@/components/invitations/serialize";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = dict(asLocale((await params).lang));
  return { title: t.inv.title, description: t.inv.sub };
}

/** دعوات المناسبات: a village timeline of invitation posts (image + caption), likes and comments. */
export default async function Invitations({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listPosts({ page, viewerId: s?.sub });
  const viewer = s ? { id: s.sub, role: s.role } : null;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <CategoryIcon name="invitations" className="h-10 w-10 text-[#C0532F]" />
        <div>
          <h1 className="font-serif text-3xl font-bold">{t.inv.title}</h1>
          <p className="text-stone-600">{t.inv.sub}</p>
        </div>
      </div>
      {!s ? <Link href={href(lang, "/login?next=" + encodeURIComponent(href(lang, "/invitations")))} className="card block p-4 text-center text-[#C0532F] hover:underline">{t.inv.signinToPost}</Link>
        : canPost(s.role) ? <PostComposer lang={lang} />
        : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.inv.providersNote}</p>}
      <div className="space-y-5" data-testid="timeline">
        {res.items.length ? res.items.map((p) => <PostCard key={p.id} p={toView(p)} lang={lang} viewer={viewer} />)
          : <p className="card p-8 text-center text-stone-500">{t.inv.empty}</p>}
      </div>
      <Pager lang={lang} page={res.page} totalPages={res.totalPages} pageHref={(p) => href(lang, `/invitations${p > 1 ? `?page=${p}` : ""}`)} />
    </div>
  );
}
