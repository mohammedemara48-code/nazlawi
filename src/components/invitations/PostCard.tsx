"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { COMMENT_MAX } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import { apiCall } from "../api-client";
import Avatar from "../Avatar";

type Author = { id: string; name: string; avatarKey: string | null };
export type PostView = {
  id: string; imageKey: string; width: number; height: number; caption: string; createdAt: string;
  author: Author; likeCount: number; commentCount: number; liked: boolean;
  comments: { id: string; body: string; createdAt: string; author: Author }[];
};
type Viewer = { id: string; role: string } | null;

function when(iso: string, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(iso));
}

/** One invitation: author, image, caption, like, comments (+ report / delete for the author or an admin). */
export default function PostCard({ p, lang, viewer }: { p: PostView; lang: Locale; viewer: Viewer }) {
  const t = dict(lang).inv;
  const router = useRouter();
  const [liked, setLiked] = useState(p.liked);
  const [likes, setLikes] = useState(p.likeCount);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const isAdmin = viewer?.role === "ADMIN";
  const canDelete = (authorId: string) => !!viewer && (viewer.id === authorId || isAdmin);
  const login = href(lang, "/login?next=" + encodeURIComponent(href(lang, "/invitations")));

  async function like() {
    if (!viewer) { window.location.href = login; return; }
    setLiked(!liked); setLikes(likes + (liked ? -1 : 1));
    const r = await apiCall<{ liked: boolean; count: number }>(`/api/posts/${p.id}/like`, lang, { method: "POST" });
    if (r.ok) { setLiked(r.data.liked); setLikes(r.data.count); } else { setLiked(liked); setLikes(likes); setMsg({ ok: false, text: r.error }); }
  }
  async function comment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setMsg(null);
    const r = await apiCall(`/api/posts/${p.id}/comments`, lang, { body: { body } });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setBody(""); router.refresh();
  }
  async function del(url: string, confirmText: string) {
    if (!confirm(confirmText)) return;
    const r = await apiCall(url, lang, { method: "DELETE" });
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    router.refresh();
  }
  async function report(target: { postId?: string; commentId?: string }) {
    if (!viewer) { window.location.href = login; return; }
    const reason = prompt(t.reportReason);
    if (reason === null) return;
    const r = await apiCall("/api/reports", lang, { body: { ...target, reason: reason.slice(0, 200) } });
    setMsg(r.ok ? { ok: true, text: t.reported } : { ok: false, text: r.error });
  }
  const small = "text-xs font-medium text-stone-500 hover:text-[#C0532F]";
  return (
    <article className="card overflow-hidden" data-testid="post" data-post-id={p.id}>
      <header className="flex items-center justify-between gap-3 p-4">
        <Link href={href(lang, `/u/${p.author.id}`)} className="flex min-w-0 items-center gap-3 hover:text-[#C0532F]">
          <Avatar k={p.author.avatarKey} name={p.author.name} />
          <div className="min-w-0">
            <p className="truncate font-bold" data-testid="post-author">{p.author.name}</p>
            <p className="text-xs text-stone-500">{when(p.createdAt, lang)}</p>
          </div>
        </Link>
        <div className="flex shrink-0 gap-3">
          {viewer && viewer.id !== p.author.id && <button type="button" className={small} onClick={() => report({ postId: p.id })} data-testid="post-report">🚩 {t.report}</button>}
          {canDelete(p.author.id) && <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => del(`/api/posts/${p.id}`, t.confirmDeletePost)} data-testid="post-delete">🗑 {dict(lang).delete}</button>}
        </div>
      </header>
      <img src={`/api/uploads/${p.imageKey}`} alt={p.caption.slice(0, 80)} width={p.width} height={p.height} loading="lazy" className="h-auto max-h-[36rem] w-full bg-stone-50 object-contain" />
      <div className="space-y-3 p-4">
        {p.caption && <p className="whitespace-pre-line leading-7 text-stone-800" data-testid="post-caption">{p.caption}</p>}
        <div className="flex items-center gap-4 border-y border-stone-100 py-2 text-sm">
          <button type="button" onClick={like} aria-pressed={liked} data-testid="post-like" className={`font-semibold ${liked ? "text-[#C0532F]" : "text-stone-600 hover:text-[#C0532F]"}`}>{liked ? "❤️" : "🤍"} {t.like}</button>
          <span className="text-stone-500" data-testid="post-like-count">{t.likes(likes)}</span>
          <span className="text-stone-500">{t.comments(p.commentCount)}</span>
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl p-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        {p.comments.length > 0 && (
          <ul className="space-y-2" data-testid="post-comments">
            {p.comments.map((c) => (
              <li key={c.id} className="flex gap-2" data-testid="comment">
                <Link href={href(lang, `/u/${c.author.id}`)}><Avatar k={c.author.avatarKey} name={c.author.name} size="h-8 w-8" /></Link>
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-stone-100 px-3 py-2">
                    <Link href={href(lang, `/u/${c.author.id}`)} className="text-sm font-bold hover:text-[#C0532F]">{c.author.name}</Link>
                    <p className="whitespace-pre-line break-words text-sm text-stone-800">{c.body}</p>
                  </div>
                  <div className="mt-0.5 flex gap-3 px-2">
                    <span className="text-[11px] text-stone-400">{when(c.createdAt, lang)}</span>
                    {viewer && viewer.id !== c.author.id && <button type="button" className="text-[11px] text-stone-500 hover:text-[#C0532F]" onClick={() => report({ commentId: c.id })} data-testid="comment-report">{t.report}</button>}
                    {canDelete(c.author.id) && <button type="button" className="text-[11px] text-red-600 hover:underline" onClick={() => del(`/api/comments/${c.id}`, t.confirmDeleteComment)} data-testid="comment-delete">{dict(lang).delete}</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {viewer ? (
          <form onSubmit={comment} className="flex gap-2">
            <input className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={COMMENT_MAX} placeholder={t.commentPh} aria-label={t.comment} data-testid="comment-input" />
            <button className="btn-primary shrink-0" disabled={busy || !body.trim()} data-testid="comment-send">{t.send}</button>
          </form>
        ) : <Link href={login} className="text-sm text-[#C0532F] hover:underline">{t.signinToPost}</Link>}
      </div>
    </article>
  );
}
