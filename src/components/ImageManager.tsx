"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { uploadTo } from "./upload-client";

type Img = { id: string; key: string };
export default function ImageManager({ lang, listingId, initial, max }: { lang: Locale; listingId: string; initial: Img[]; max: number }) {
  const t = dict(lang);
  const [imgs, setImgs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null);
    const r = await uploadTo<{ image: Img }>(`/api/listings/${listingId}/images`, lang, file, { kind: "image", target: { listingId } });
    setBusy(false);
    if (!r.ok) setErr(r.error ?? t.genericError);
    else setImgs((x) => [...x, r.data.image]);
  }
  async function remove(id: string) {
    if (!confirm(t.confirmDelete)) return;
    const r = await fetch(`/api/listings/${listingId}/images/${id}?lang=${lang}`, { method: "DELETE" });
    if (r.ok) setImgs((x) => x.filter((i) => i.id !== id));
  }
  return (
    <section className="card mx-auto mt-6 max-w-2xl space-y-3 p-6">
      <h2 className="text-xl font-bold">{t.images}</h2>
      <p className="text-xs text-stone-500">{t.imagesHint}</p>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {imgs.map((i) => (
          <div key={i.id} className="relative">
            <img src={`/api/uploads/${i.key}`} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <button type="button" onClick={() => remove(i.id)} className="absolute end-1 top-1 rounded-full bg-white/90 px-2 text-sm text-red-700 shadow">✕</button>
          </div>
        ))}
      </div>
      {imgs.length < max && (
        <label className={`btn-outline cursor-pointer ${busy ? "opacity-50" : ""}`}>
          {busy ? t.uploading : `+ ${t.upload}`}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} disabled={busy} />
        </label>
      )}
    </section>
  );
}
