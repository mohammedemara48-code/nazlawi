"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
import { apiCall } from "./api-client";

export default function GroupManager({ lang, storeId, groups }: { lang: Locale; storeId: string; groups: { id: string; nameAr: string; nameEn: string }[] }) {
  const t = dict(lang);
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">{t.groups}</h2>
      <p className="text-sm text-stone-500">{t.groupsHint}</p>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <span key={g.id} className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-sm">
            {lang === "en" ? g.nameEn : g.nameAr}
            <button type="button" aria-label={t.delete} className="text-red-600" onClick={async () => {
              if (!confirm(t.confirmDelete)) return;
              await apiCall(`/api/stores/${storeId}/groups/${g.id}`, lang, { method: "DELETE" }); router.refresh();
            }}>✕</button>
          </span>
        ))}
      </div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const r = await apiCall(`/api/stores/${storeId}/groups`, lang, { body: Object.fromEntries(new FormData(form)) });
        if (!r.ok) setErr(r.error); else { setErr(null); form.reset(); router.refresh(); }
      }}>
        <input name="nameAr" placeholder={t.nameAr} className="input w-40 py-1.5" />
        <input name="nameEn" placeholder={t.nameEn} dir="ltr" className="input w-40 py-1.5" />
        <button className="btn-outline">+ {t.addGroup}</button>
      </form>
    </section>
  );
}
