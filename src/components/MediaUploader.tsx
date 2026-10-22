"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { apiCall } from "./api-client";
import { uploadTo } from "./upload-client";

/** Uploads a store logo/cover or a promo video (listing or store) and refreshes the page. */
export default function MediaUploader({ lang, url, fields, target, accept, label, busyLabel: _busyLabel, current, deleteUrl, testId }: {
  lang: Locale; url: string; fields?: Record<string, string>; target?: Record<string, string>; accept: string; label: string; busyLabel?: string;
  current?: React.ReactNode; deleteUrl?: string; testId?: string;
}) {
  const t = dict(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null); setNote(null); setSaving(false);
    const kind = accept.startsWith("video") ? "video" : "image";
    const r = await uploadTo(url, lang, file, { kind, fields, target: target ?? fields ?? {}, onProgress: setPct, onFinalizing: () => setSaving(true) });
    setBusy(false); setPct(null); setSaving(false);
    if (!r.ok) { setErr(r.error); return; }
    if (kind === "video") setNote(lang === "en" ? "Video uploaded — awaiting admin approval." : "تم رفع الفيديو — بانتظار موافقة الإدارة.");
    router.refresh();
  }
  return (
    <div className="space-y-2" data-testid={testId}>
      {current}
      {note && <p role="status" className="rounded-xl bg-emerald-50 p-2 text-sm text-emerald-800">{note}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <label className={`btn-outline cursor-pointer text-sm ${busy ? "opacity-50" : ""}`}>
          {busy ? (saving ? (lang === "en" ? "Saving…" : "جاري الحفظ…") : `${t.uploading}${pct != null ? ` ${pct}%` : ""}`) : `⬆ ${label}`}
          <input type="file" accept={accept} className="hidden" onChange={upload} disabled={busy} />
        </label>
        {/* Phones (incl. the Android app): open the camera directly. */}
        <label className={`btn-outline cursor-pointer text-sm sm:hidden ${busy ? "opacity-50" : ""}`}>
          📷 {t.camera}
          <input type="file" accept={accept} capture="environment" className="hidden" onChange={upload} disabled={busy} aria-label={t.camera} />
        </label>
        {deleteUrl && (
          <button type="button" className="btn border border-red-200 bg-red-50 text-sm text-red-700" disabled={busy}
            onClick={async () => { if (confirm(t.confirmDelete)) { await apiCall(deleteUrl, lang, { method: "DELETE" }); router.refresh(); } }}>{t.delete}</button>
        )}
      </div>
    </div>
  );
}
