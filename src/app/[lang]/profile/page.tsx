import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { getAccount } from "@/lib/services/account";
import { listPosts } from "@/lib/services/posts";
import Avatar from "@/components/Avatar";
import MediaUploader from "@/components/MediaUploader";
import PostCard from "@/components/invitations/PostCard";
import { toView } from "@/components/invitations/serialize";

type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).prof.title };
}
/** The signed-in user's own page: profile photo + their invitation posts. */
export default async function Profile({ params }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login?next=" + encodeURIComponent(href(lang, "/profile"))));
  const a = await getAccount(s.sub);
  if (!a) redirect(href(lang, "/login"));
  const posts = await listPosts({ authorId: s.sub, viewerId: s.sub, pageSize: 30 });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="card space-y-4 p-5" data-testid="profile-card">
        <div className="flex items-center gap-4">
          <Avatar k={a.avatarKey} name={a.name} size="h-20 w-20 text-2xl" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-2xl font-bold">{a.name}</h1>
            <p className="text-sm text-stone-500">{t.prof.memberSince} {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium" }).format(a.createdAt)}</p>
            <Link href={href(lang, `/u/${a.id}`)} className="text-sm text-[#C0532F] hover:underline">/u/{a.id.slice(0, 8)}…</Link>
          </div>
        </div>
        <div>
          <h2 className="font-bold">{t.prof.photo}</h2>
          <p className="mb-2 text-xs text-stone-500">{t.prof.photoHint}</p>
          <MediaUploader lang={lang} url="/api/account/avatar" testId="upload-avatar" target={{ purpose: "avatar" }} accept="image/jpeg,image/png,image/webp" label={t.upload}
            deleteUrl={a.avatarKey ? "/api/account/avatar" : undefined} />
        </div>
        <Link href={href(lang, "/settings")} className="text-sm text-stone-600 hover:text-[#C0532F]">⚙️ {t.prof.editAccount}</Link>
      </section>
      <h2 className="text-xl font-bold">{t.prof.myPosts}</h2>
      <div className="space-y-5">
        {posts.items.length ? posts.items.map((p) => <PostCard key={p.id} p={toView(p)} lang={lang} viewer={{ id: s.sub, role: s.role }} />)
          : <Link href={href(lang, "/invitations")} className="card block p-6 text-center text-stone-500 hover:text-[#C0532F]">{t.inv.title} →</Link>}
      </div>
    </div>
  );
}
