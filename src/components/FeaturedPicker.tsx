"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { apiCall } from "./api-client";

type Item = { id: string; nameAr: string; nameEn: string; status: string; featuredPosition: number | null };
/** Pick up to 3 approved listings, in order. Server enforces the same rules. */
export default function FeaturedPicker({ lang, storeId, items }: { lang: Locale; storeId: string; items: Item[] }) {
  const t = dict(lang);
  const router = useRouter();
  const initial = items.filter((i) => i.featuredPosition != null).sort((a, b) => a.featuredPosition! - b.featuredPosition!).map((i) => i.id);
  const [sel, setSel] = useState<string[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));
  const move = (id: string, d: -1 | 1) => setSel((s) => { const i = s.indexOf(id); const j = i + d; if (j < 0 || j >= s.length) return s; const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  async function save() {
    const r = await apiCall(`/api/stores/${storeId}/featured`, lang, { method: "PUT", body: { listingIds: sel } });
    setMsg(r.ok ? { ok: true, text: t.saved } : { ok: false, text: r.error! });
    router.refresh();
  }
  const name = (i: Item) => (lang === "en" ? i.nameEn : i.nameAr);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">★ {t.featuredTitle}</h2>
      <p className="text-sm text-stone-500">{t.featuredHint}</p>
      {msg && <p role="status" className={`rounded-xl p-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <ol className="space-y-2">
        {sel.map((id, i) => { const it = items.find((x) => x.id === id)!; return (
          <li key={id} className="flex items-center justify-between rounded-xl border border-[#C0532F]/30 bg-[#C0532F]/5 px-3 py-2 text-sm">
            <span><b className="text-[#C0532F]">{i + 1}.</b> {name(it)}</span>
            <span className="flex gap-1">
              <button type="button" className="btn-outline px-2 py-0.5" onClick={() => move(id, -1)} aria-label="up">↑</button>
              <button type="button" className="btn-outline px-2 py-0.5" onClick={() => move(id, 1)} aria-label="down">↓</button>
              <button type="button" className="btn-outline px-2 py-0.5" onClick={() => toggle(id)} aria-label="remove">✕</button>
            </span>
          </li>); })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {items.filter((i) => !sel.includes(i.id)).map((i) => (
          <button type="button" key={i.id} disabled={i.status !== "APPROVED" || sel.length >= 3} onClick={() => toggle(i.id)}
            title={i.status !== "APPROVED" ? t.approveFirst : undefined} className="btn-outline text-sm disabled:opacity-40">+ {name(i)}</button>
        ))}
      </div>
      <button type="button" onClick={save} className="btn-primary">{t.save}</button>
    </section>
  );
}
