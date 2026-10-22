"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { apiCall } from "./api-client";

type Kind = "store" | "listing";
type Action = "delete" | "restore" | "purge";
const L = {
  delete: { ar: "حذف نهائي", en: "Delete permanently" },
  restore: { ar: "استرجاع", en: "Restore" },
  purge: { ar: "حذف نهائي", en: "Delete permanently" },
};
function question(kind: Kind, action: Action, en: boolean) {
  const what = kind === "store" ? (en ? "this store (and all its products)" : "المتجر ده (وكل منتجاته)") : (en ? "this product" : "المنتج ده");
  if (action === "delete" || action === "purge") return en ? `⚠️ Permanently delete ${what}?\n\nEverything is removed from the database and storage: ${kind === "store" ? "products, sections, promotions, " : ""}photos and videos. It disappears from the site immediately.\n\nThis can't be undone.` : `⚠️ حذف ${what} نهائياً؟\n\nكل حاجة هتتمسح من قاعدة البيانات والتخزين: ${kind === "store" ? "المنتجات والأقسام والعروض و" : ""}الصور والفيديوهات. هيختفي من الموقع فوراً.\n\nمفيش رجوع.`;
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
      : await apiCall(base, lang, { method: "DELETE" });
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
