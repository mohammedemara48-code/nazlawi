"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
/** Re-sends the verification email (server rate limit: 3 per 15 min) and reminds the user to check spam. */
export default function ResendVerification({ lang }: { lang: Locale }) {
  const t = dict(lang);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="flex flex-col gap-1">
      <button type="button" className="btn-outline text-sm" disabled={busy} data-testid="resend-verification" onClick={async () => {
        setBusy(true);
        const r = await fetch(`/api/auth/resend-verification?lang=${lang}`, { method: "POST" }).catch(() => null);
        setBusy(false);
        setMsg(r?.ok ? { ok: true, text: t.resentSpam } : { ok: false, text: (await r?.json().catch(() => null))?.error?.message ?? t.genericError });
      }}>{busy ? "…" : t.resend}</button>
      {msg && <span role={msg.ok ? "status" : "alert"} data-testid="resend-msg" className={msg.ok ? "text-emerald-800" : "text-red-700"}>{msg.text}</span>}
    </span>
  );
}
