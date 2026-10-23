"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { POST_CAPTION_MAX } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { uploadTo } from "../upload-client";
import { compressImage } from "../merchant/image-compress";

const ACCEPT = "image/jpeg,image/png,image/webp";
/** New invitation: one image (JPG/PNG/WebP ≤5 MB, compressed in the browser) + a caption. */
export default function PostComposer({ lang }: { lang: Locale }) {
  const t = dict(lang).inv;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    if (!ACCEPT.split(",").includes(f.type)) { setErr(dict(lang).imagesHint); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setErr(t.imageRequired); return; }
    setBusy(true); setErr(null);
    const small = await compressImage(file).catch(() => file);
    const r = await uploadTo("/api/posts", lang, small, { kind: "image", fields: { caption }, target: { purpose: "post" } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setCaption("");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-4" data-testid="post-composer">
      <h2 className="font-bold">{t.newPost}</h2>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {preview && <img src={preview} alt="" className="max-h-80 w-full rounded-xl object-contain bg-stone-50" />}
      <div className="flex flex-wrap gap-2">
        <label className="btn-outline cursor-pointer text-sm">
          🖼️ {file ? t.changeImage : t.pickImage}
          <input type="file" accept={ACCEPT} className="hidden" onChange={pick} disabled={busy} data-testid="post-file" />
        </label>
        <label className="btn-outline cursor-pointer text-sm sm:hidden">
          📷 {dict(lang).camera}
          <input type="file" accept={ACCEPT} capture="environment" className="hidden" onChange={pick} disabled={busy} />
        </label>
      </div>
      <div>
        <label className="label" htmlFor="post-caption">{t.caption}</label>
        <textarea id="post-caption" className="input" rows={3} maxLength={POST_CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t.captionPh} />
        <p className="mt-1 flex justify-between text-xs text-stone-400"><span>{t.dailyLimit}</span><span dir="ltr">{caption.length}/{POST_CAPTION_MAX}</span></p>
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={busy} data-testid="post-publish">{busy ? t.publishing : t.publish}</button>
    </form>
  );
}
