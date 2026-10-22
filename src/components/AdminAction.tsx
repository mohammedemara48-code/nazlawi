"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { apiCall } from "./api-client";

type Kind = "store" | "listing";
type Action = "delete" | "restore" | "purge";
const L = {
  delete: { ar: "حذف", en: "Delete" },
  restore: { ar: "استرجاع", en: "Restore" },
  purge: { ar: "حذف نهائي", en: "Delete permanently" },
};
function question(kind: Kind, action: Action, en: boolean) {
  const what = kind === "store" ? (en ? "this store (and all its products)" : "المتجر ده (وكل منتجاته)") : (en ? "this product" : "المنتج ده");
  if (action === "delete") return en ? `Delete ${what}? It disappears from the site immediately. You can restore it from Trash for 30 days, then it's removed permanently.` : `حذف ${what}؟ هيختفي من الموقع فوراً. تقدر تسترجعه من "المحذوفات" خلال 30 يوم، بعدها يتحذف نهائياً.`;
  if (action === "purge") return en ? `Permanently delete ${what}? Photos and videos are removed too. This can't be undone.` : `حذف ${what} نهائياً؟ الصور والفيديوهات هتتمسح كمان. مفيش رجوع.`;
  return en ? `Restore ${what}?` : `استرجاع ${what}؟`;
}

/** Admin delete / restore / permanent delete with a confirm dialog (server side writes the audit log). */
export default function AdminAction({ lang, kind, id, action }: { lang: Locale; kind: Kind; id: string; action: Action }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const en = lang === "en";
  const base = `/api/admin/${kind === "store" ? "stores" : "listings"}/${id}`;
  const run = async () => {
    if (!window.confirm(question(kind, action, en))) return;
    setBusy(true);
    const r = action === "restore" ? await apiCall(`${base}/restore`, lang, { method: "POST" })
      : await apiCall(action === "purge" ? `${base}?hard=1` : base, lang, { method: "DELETE" });
    setBusy(false);
    setErr(r.ok ? null : r.error);
    // Remove the row right away (don't wait for the server re-render), then refresh the list from the server.
    if (r.ok) { const row = ref.current?.closest("li,tr,[data-admin-row]") as HTMLElement | null; if (row) row.style.display = "none"; }
    router.refresh();
  };
  const danger = action !== "restore";
  return (
    <span ref={ref} className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} data-testid={`admin-${action}-${kind}`} onClick={run}
        className={danger ? "btn border border-red-200 bg-red-50 py-1 text-sm text-red-700 hover:bg-red-100" : "btn-outline py-1 text-sm"}>
        {busy ? "…" : L[action][en ? "en" : "ar"]}
      </button>
      {err && <span role="alert" className="text-xs text-red-700">{err}</span>}
    </span>
  );
}
