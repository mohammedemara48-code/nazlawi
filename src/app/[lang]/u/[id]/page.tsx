import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLocale, dict } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listPosts, publicProfile } from "@/lib/services/posts";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/invitations/PostCard";
import { toView } from "@/components/invitations/serialize";

type Props = { params: Promise<{ lang: string; id: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, lang } = await params;
  const u = await publicProfile(id);
  return { title: u?.name ?? dict(asLocale(lang)).notFound, robots: { index: false } };
}
/** Public user page: photo, name and their invitation posts. No email/phone is shown. */
export default async function UserPage({ params }: Props) {
  const { lang: l, id } = await params;
  const lang = asLocale(l);
  const t = dict(lang);
  const u = await publicProfile(id);
  if (!u) notFound();
  const s = await getServerSession();
  const posts = await listPosts({ authorId: u.id, viewerId: s?.sub, pageSize: 30 });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="card flex items-center gap-4 p-5" data-testid="user-card">
        <Avatar k={u.avatarKey} name={u.name} size="h-20 w-20 text-2xl" />
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-bold">{u.name}</h1>
          <p className="text-sm text-stone-500">{t.prof.memberSince} {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium" }).format(u.createdAt)} · {t.prof.posts}: {u._count.posts}</p>
        </div>
      </section>
      <div className="space-y-5">
        {posts.items.length ? posts.items.map((p) => <PostCard key={p.id} p={toView(p)} lang={lang} viewer={s ? { id: s.sub, role: s.role } : null} />)
          : <p className="card p-8 text-center text-stone-500">{t.empty}</p>}
      </div>
    </div>
  );
}
