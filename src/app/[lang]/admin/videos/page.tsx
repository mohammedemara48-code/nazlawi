import type { Metadata } from "next";
import VideoView from "@/components/VideoView";
import { notFound } from "next/navigation";
import { VIDEO_STATUSES } from "@/lib/constants";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { adminListVideos } from "@/lib/services/videos";
import AdminNav from "@/components/AdminNav";
import ModerationButtons from "@/components/ModerationButtons";
import Pager from "@/components/Pager";
import { StatusTabs } from "../_shared";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ status?: string; page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).videos };
}
export default async function AdminVideos({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const sp = await searchParams;
  const status = (VIDEO_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "PENDING";
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await adminListVideos(status, page, 12);
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="videos" />
      <StatusTabs lang={lang} base="/admin/videos" statuses={VIDEO_STATUSES} active={status} labels={t.videoStatus} />
      <div className="grid gap-4 sm:grid-cols-2">
        {res.items.map((v) => (
          <article key={v.id} className="card space-y-2 overflow-hidden p-3">
            <VideoView v={v} lang={lang} className="aspect-video w-full" />
            <p className="text-sm font-semibold">{v.listing ? (lang === "en" ? v.listing.nameEn : v.listing.nameAr) : v.store ? `🏪 ${lang === "en" ? v.store.nameEn : v.store.nameAr}` : ""}</p>
            <p className="text-xs text-stone-500">{v.durationSec}s · {v.width}×{v.height} · {(v.sizeBytes / 1024 / 1024).toFixed(1)} MB{v.isExample ? ` · ${t.example}` : ""}</p>
            <ModerationButtons lang={lang} url={`/api/admin/videos/${v.id}/status`} actions={[{ label: t.approve, body: { status: "APPROVED" } }, { label: t.reject, body: { status: "REJECTED" }, tone: "danger" }]} />
          </article>
        ))}
      </div>
      {!res.items.length && <p className="card p-8 text-center text-stone-500">{t.empty}</p>}
      <Pager lang={lang} page={res.page} totalPages={res.totalPages} pageHref={(p) => href(lang, `/admin/videos?status=${status}&page=${p}`)} />
    </div>
  );
}
