import AutoRefresh from "@/components/AutoRefresh";
import VideoView from "@/components/VideoView";
import StoreForm from "@/components/StoreForm";
import MediaUploader from "@/components/MediaUploader";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import type { getMyStore } from "@/lib/services/stores";

type S = NonNullable<Awaited<ReturnType<typeof getMyStore>>>;
/** "Store info" tab: logo, cover, promo video, then the store form (name, phones, WhatsApp, hours, map). */
export default function StoreInfoPanel({ lang, store }: { lang: Locale; store: S }) {
  const t = dict(lang);
  const img = "image/jpeg,image/png,image/webp";
  return (
    <div className="space-y-5">
      <section id="store-media" className="card grid gap-6 p-5 sm:grid-cols-2" data-testid="store-media">
        <div>
          <h2 className="mb-2 font-bold">{t.logo}</h2>
          <MediaUploader lang={lang} url={`/api/stores/${store.id}/images?kind=logo`} testId="upload-logo" target={{ storeId: store.id }} accept={img} label={t.upload}
            current={store.logoKey ? <img src={`/api/uploads/${store.logoKey}`} alt="" className="h-24 w-24 rounded-xl object-cover" /> : null} />
        </div>
        <div>
          <h2 className="mb-2 font-bold">{t.cover}</h2>
          <MediaUploader lang={lang} url={`/api/stores/${store.id}/images?kind=cover`} testId="upload-cover" target={{ storeId: store.id }} accept={img} label={t.upload}
            current={store.coverKey ? <img src={`/api/uploads/${store.coverKey}`} alt="" className="h-24 w-full rounded-xl object-cover" /> : null} />
        </div>
        <div className="sm:col-span-2">
          <h2 className="font-bold">{t.video}</h2>
          <p className="mb-2 text-xs text-stone-500">{t.videoHint}</p>
          <AutoRefresh active={!!store.video && (store.video.processing === "QUEUED" || store.video.processing === "PROCESSING")} />
          <MediaUploader lang={lang} url="/api/videos" testId="upload-video" fields={{ storeId: store.id }} accept="video/mp4,video/webm,video/quicktime" label={t.uploadVideo}
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
