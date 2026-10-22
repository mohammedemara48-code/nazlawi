import type { Metadata } from "next";
import AutoRefresh from "@/components/AutoRefresh";
import VideoView from "@/components/VideoView";
import { notFound, redirect } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { prisma } from "@/lib/db";
import { MAX_IMAGES } from "@/lib/services/listings";
import ListingForm from "@/components/ListingForm";
import ImageManager from "@/components/ImageManager";
import MediaUploader from "@/components/MediaUploader";
type Props = { params: Promise<{ lang: string; id: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).editListing };
}
export default async function Page({ params }: Props) {
  const { lang: l, id } = await params;
  const lang = asLocale(l);
  const t = dict(lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login"));
  const p = await prisma.listing.findUnique({ where: { id }, omit: { searchText: true }, include: { images: { orderBy: { position: "asc" } }, video: true, store: { include: { groups: { orderBy: { position: "asc" } } } } } });
  if (!p || (s.role !== "ADMIN" && p.ownerId !== s.sub)) notFound();
  return (
    <>
      <ListingForm lang={lang} initial={p} groups={p.store?.groups ?? []} />
      <ImageManager lang={lang} listingId={p.id} initial={p.images.map((i) => ({ id: i.id, key: i.key }))} max={MAX_IMAGES} />
      <section className="card mx-auto mt-6 max-w-2xl space-y-2 p-6">
        <h2 className="text-xl font-bold">{t.video}</h2>
        <p className="text-xs text-stone-500">{t.videoHint}</p>
        <AutoRefresh active={!!p.video && (p.video.processing === "QUEUED" || p.video.processing === "PROCESSING")} />
        <MediaUploader lang={lang} url="/api/videos" fields={{ listingId: p.id }} accept="video/mp4,video/webm,video/quicktime" label={t.uploadVideo} busyLabel={t.processing}
          deleteUrl={p.video ? `/api/videos/${p.video.id}` : undefined}
          current={p.video ? (<div><VideoView v={p.video} lang={lang} className="max-h-64" />
            <p className="text-xs text-stone-500">{t.videoStatus[p.video.status]} · {p.video.durationSec}s</p></div>) : null} />
      </section>
    </>
  );
}
