"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, type Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";

export default function UserActions({ lang, id, role, status, verified, self }: { lang: Locale; id: string; role: string; status: string; verified: boolean; self: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setNote(null);
    const r = await fetch(`${url}?lang=${lang}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) setNote((await r.json().catch(() => null))?.error?.message ?? t.genericError);
    else if (url.endsWith("resend-verification")) setNote(t.resent);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select aria-label={t.role} className="input w-auto py-1" disabled={busy} value={role}
        onChange={(e) => call(`/api/admin/users/${id}`, "PATCH", { role: e.target.value })}>
        {ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
      </select>
      <button disabled={busy} className="btn-outline py-1" onClick={() => call(`/api/admin/users/${id}`, "PATCH", { status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>
        {status === "ACTIVE" ? t.suspend : t.unsuspend}
      </button>
      {!verified && <button disabled={busy} className="btn-primary py-1" onClick={() => call(`/api/admin/users/${id}`, "PATCH", { verified: true })}>{t.verifyUser}</button>}
      {!verified && <button disabled={busy} className="btn-outline py-1" onClick={() => call(`/api/admin/users/${id}/resend-verification`, "POST")}>{t.resend}</button>}
      {self && <span className="text-xs text-stone-500">({t.you})</span>}
      {note && <span role="status" className="text-xs text-red-700">{note}</span>}
    </div>
  );
}
