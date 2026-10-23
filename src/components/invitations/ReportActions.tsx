"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { apiCall } from "../api-client";

/** Admin: permanently delete reported content, or dismiss its reports. */
export default function ReportActions({ lang, target }: { lang: Locale; target: { postId?: string; commentId?: string } }) {
  const t = dict(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(kind: "delete" | "dismiss") {
    if (kind === "delete" && !confirm(target.postId ? t.inv.confirmDeletePost : t.inv.confirmDeleteComment)) return;
    setBusy(true);
    const r = kind === "dismiss" ? await apiCall("/api/admin/reports", lang, { method: "DELETE", body: target })
      : await apiCall(target.postId ? `/api/posts/${target.postId}` : `/api/comments/${target.commentId}`, lang, { method: "DELETE" });
    setBusy(false);
    setErr(r.ok ? null : r.error);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => run("delete")} data-testid="report-delete" className="btn border border-red-200 bg-red-50 py-1 text-sm text-red-700 hover:bg-red-100">🗑 {t.reports.deleteForever}</button>
      <button type="button" disabled={busy} onClick={() => run("dismiss")} data-testid="report-dismiss" className="btn-outline py-1 text-sm">{t.reports.dismiss}</button>
      {err && <span role="alert" className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
