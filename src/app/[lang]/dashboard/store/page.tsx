import type { Metadata } from "next";
import AutoRefresh from "@/components/AutoRefresh";
import VideoView from "@/components/VideoView";
import { redirect } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { getMyStore } from "@/lib/services/stores";
import StoreForm from "@/components/StoreForm";
import MediaUploader from "@/components/MediaUploader";

type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).editStore };
}
export default async function StoreSettings({ params }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (!s) redirect(href(lang, "/login"));
  const store = await getMyStore(s.sub);
  if (!store) redirect(href(lang, "/onboarding"));
  const img = "image/jpeg,image/png,image/webp";
  return (
    <div className="space-y-6">
      <section className="card mx-auto grid max-w-3xl gap-6 p-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 font-bold">{t.logo}</h2>
          <MediaUploader lang={lang} url={`/api/stores/${store.id}/images?kind=logo`} target={{ storeId: store.id }} accept={img} label={t.upload}
            current={store.logoKey ? <img src={`/api/uploads/${store.logoKey}`} alt="" className="h-24 w-24 rounded-xl object-cover" /> : null} />
        </div>
        <div>
          <h2 className="mb-2 font-bold">{t.cover}</h2>
          <MediaUploader lang={lang} url={`/api/stores/${store.id}/images?kind=cover`} target={{ storeId: store.id }} accept={img} label={t.upload}
            current={store.coverKey ? <img src={`/api/uploads/${store.coverKey}`} alt="" className="h-24 w-full rounded-xl object-cover" /> : null} />
        </div>
        <div className="sm:col-span-2">
          <h2 className="font-bold">{t.video}</h2>
          <p className="mb-2 text-xs text-stone-500">{t.videoHint}</p>
          <AutoRefresh active={!!store.video && (store.video.processing === "QUEUED" || store.video.processing === "PROCESSING")} />
        <MediaUploader lang={lang} url="/api/videos" fields={{ storeId: store.id }} accept="video/mp4,video/webm,video/quicktime" label={t.uploadVideo} busyLabel={t.processing}
            deleteUrl={store.video ? `/api/videos/${store.video.id}` : undefined}
            current={store.video ? (
              <div><VideoView v={store.video} lang={lang} className="max-h-64" />
                <p className="text-xs text-stone-500">{t.videoStatus[store.video.status]} · {store.video.durationSec}s</p></div>) : null} />
        </div>
      </section>
      <StoreForm lang={lang} initial={store} />
    </div>
  );
}
