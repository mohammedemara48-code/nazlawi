import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";

type V = { key: string | null; posterKey: string | null; processing: string; error?: string | null };
/** Plays a processed video; otherwise shows "processing" or "failed" (owner/admin views only see these). */
export default function VideoView({ v, lang, className = "max-h-[480px] w-full" }: { v: V; lang: Locale; className?: string }) {
  const t = dict(lang);
  if (v.processing === "READY" && v.key)
    return <video controls playsInline preload="metadata" poster={v.posterKey ? `/api/uploads/${v.posterKey}` : undefined} src={`/api/uploads/${v.key}`} className={`${className} rounded-xl bg-black`} />;
  const failed = v.processing === "FAILED";
  return (
    <div role="status" className={`flex aspect-video max-h-64 w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-center text-sm ${failed ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>
      {!failed && <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-[#C0532F]" aria-hidden />}
      <p className="font-semibold">{failed ? t.videoFailed : t.videoProcessing}</p>
      {failed && v.error && <p className="text-xs">{t.videoErrors[v.error] ?? v.error}</p>}
    </div>
  );
}
