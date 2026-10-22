"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";

export default function ListingActions({ lang, id, available, showAvailability, admin }: { lang: Locale; id: string; available: boolean; showAvailability: boolean; admin?: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    const r = await fetch(`${url}?lang=${lang}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) alert((await r.json().catch(() => null))?.error?.message ?? t.genericError);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {showAvailability && (
        <button disabled={busy} className="btn-outline" onClick={() => call(`/api/listings/${id}/availability`, "PATCH", { available: !available })}>
          {available ? `🟢 ${t.available}` : `⚪ ${t.unavailable}`}
        </button>
      )}
      {admin && <>
        <button disabled={busy} className="btn-outline" onClick={() => call(`/api/admin/listings/${id}/status`, "PATCH", { status: "APPROVED" })}>{t.approve}</button>
        <button disabled={busy} className="btn-outline" onClick={() => call(`/api/admin/listings/${id}/status`, "PATCH", { status: "HIDDEN" })}>{t.hide}</button>
      </>}
      <a className="btn-outline" href={href(lang, `/dashboard/edit/${id}`)}>{t.edit}</a>
      <button disabled={busy} className="btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        onClick={() => confirm(t.confirmDelete) && call(`/api/listings/${id}`, "DELETE")}>{t.delete}</button>
    </div>
  );
}
