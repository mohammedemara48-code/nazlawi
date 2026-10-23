"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { apiCall } from "./api-client";

type Promo = { id: string; status: string; targetType: string; startsAt: string | Date; endsAt: string | Date; listing: { nameAr: string; nameEn: string } | null; store: { nameAr: string; nameEn: string } };
export default function PromotionPanel({ lang, storeId, listings, promos }: { lang: Locale; storeId: string; listings: { id: string; nameAr: string; nameEn: string }[]; promos: Promo[] }) {
  const t = dict(lang);
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const fmt = (d: string | Date) => new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG");
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">🔥 {t.promotions}</h2>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        const isStore = fd.target === "store";
        const r = await apiCall("/api/promotions", lang, { body: {
          targetType: isStore ? "STORE" : "LISTING", storeId: isStore ? storeId : undefined, listingId: isStore ? undefined : fd.target,
          startsAt: new Date(fd.startsAt).toISOString(), endsAt: new Date(new Date(fd.endsAt).getTime() + 86399_000).toISOString(), note: fd.note,
        } });
        if (!r.ok) setErr(r.error); else { setErr(null); router.refresh(); }
      }}>
        <label className="sm:col-span-2"><span className="label">{t.promoTarget}</span>
          <select name="target" className="input"><option value="store">{t.promoStore}</option>{listings.map((l) => <option key={l.id} value={l.id}>{lang === "en" ? l.nameEn : l.nameAr}</option>)}</select></label>
        <label><span className="label">{t.startsAt}</span><input type="date" name="startsAt" defaultValue={today} className="input" /></label>
        <label><span className="label">{t.endsAt}</span><input type="date" name="endsAt" defaultValue={week} className="input" /></label>
        <input name="note" placeholder={t.note} className="input sm:col-span-3" />
        <button className="btn-primary">{t.requestPromotion}</button>
      </form>
      {promos.length > 0 && (
        <ul className="divide-y divide-stone-100 text-sm">
          {promos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <span>{p.targetType === "LISTING" && p.listing ? (lang === "en" ? p.listing.nameEn : p.listing.nameAr) : `🏪 ${lang === "en" ? p.store.nameEn : p.store.nameAr}`} · {fmt(p.startsAt)} → {fmt(p.endsAt)}</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{t.promoStatus[p.status]}</span>
                {(p.status === "PENDING" || p.status === "APPROVED") && <button className="text-xs text-red-600" onClick={async () => { await apiCall(`/api/promotions/${p.id}`, lang, { method: "DELETE" }); router.refresh(); }}>{t.cancel}</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
