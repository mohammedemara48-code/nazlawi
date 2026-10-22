"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { apiCall } from "./api-client";

/** Generic admin buttons that PATCH a JSON body and refresh. */
export default function ModerationButtons({ lang, url, actions }: { lang: Locale; url: string; actions: { label: string; body: Record<string, unknown>; tone?: "danger" }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {actions.map((a) => (
        <button key={a.label} disabled={busy} className={a.tone === "danger" ? "btn border border-red-200 bg-red-50 py-1 text-red-700" : "btn-outline py-1"}
          onClick={async () => { setBusy(true); const r = await apiCall(url, lang, { method: "PATCH", body: a.body }); setBusy(false); setErr(r.ok ? null : r.error); router.refresh(); }}>
          {a.label}
        </button>
      ))}
      {err && <span role="alert" className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
