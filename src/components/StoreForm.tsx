"use client";
import { useState } from "react";
import type { Store } from "@prisma/client";
import { CATEGORIES, MEDICAL_SUBS, type Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import { apiCall } from "./api-client";
import CategoryIcon from "./CategoryIcon";
import MapPicker from "./MapPicker";

type S = Omit<Store, "searchText">;
type TextField = "nameAr" | "nameEn" | "bioAr" | "bioEn" | "phone" | "whatsapp" | "addressAr" | "addressEn" | "area";

/** Onboarding (create) and store editing. The section (category) is chosen from the six tabs. */
export default function StoreForm({ lang, initial }: { lang: Locale; initial?: S }) {
  const t = dict(lang);
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [sub, setSub] = useState<string>(initial?.subcategory ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<{ field: string; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial?.latitude != null && initial?.longitude != null ? { lat: initial.latitude, lng: initial.longitude } : null);
  const fe = (f: string) => fields.find((x) => x.field === f)?.message;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null); setFields([]);
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { ...fd, category: category || undefined, subcategory: category === "medical" ? sub || undefined : null, latitude: pin?.lat ?? null, longitude: pin?.lng ?? null };
    const r = await apiCall(initial ? `/api/stores/${initial.id}` : "/api/stores", lang, { method: initial ? "PATCH" : "POST", body });
    setBusy(false);
    if (!r.ok) { setErr(r.error); setFields(r.details); return; }
    window.location.href = href(lang, initial ? "/dashboard" : "/dashboard/store");
  }
  const F = ({ name, label, ltr, area }: { name: TextField; label: string; ltr?: boolean; area?: boolean }) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {area ? <textarea id={name} name={name} rows={3} className="input" dir={ltr ? "ltr" : "rtl"} defaultValue={initial?.[name] ?? ""} />
        : <input id={name} name={name} className="input" dir={ltr ? "ltr" : "rtl"} defaultValue={initial?.[name] ?? ""} />}
      {fe(name) && <p className="mt-1 text-xs text-red-600">{fe(name)}</p>}
    </div>
  );
  return (
    <form onSubmit={submit} className="card mx-auto max-w-3xl space-y-5 p-6" noValidate>
      <div>
        <h1 className="font-serif text-3xl font-bold">{initial ? t.editStore : t.onboardingTitle}</h1>
        {!initial && <p className="mt-1 text-stone-600">{t.onboardingSub}</p>}
      </div>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <fieldset>
        <legend className="label">{t.chooseSection} *</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button type="button" role="radio" aria-checked={category === c} key={c} onClick={() => setCategory(c)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-start transition ${category === c ? "border-[#C0532F] bg-[#C0532F]/10 ring-2 ring-[#C0532F]/30" : "border-stone-200 bg-white hover:border-stone-300"}`}>
              <CategoryIcon name={c} className="h-6 w-6 text-[#C0532F]" />
              <span className="text-sm font-semibold">{t.categories[c][0]}</span>
            </button>
          ))}
        </div>
        {fe("category") && <p className="mt-1 text-xs text-red-600">{fe("category")}</p>}
        {category === "medical" && (
          <div className="mt-3 flex gap-2">
            {MEDICAL_SUBS.map((s) => (
              <button type="button" key={s} onClick={() => setSub(s)} className={sub === s ? "btn-primary" : "btn-outline"}>{t.subs[s]}</button>
            ))}
          </div>
        )}
        {fe("subcategory") && <p className="mt-1 text-xs text-red-600">{fe("subcategory")}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {F({ name: "nameAr", label: t.storeNameAr })}
        {F({ name: "nameEn", label: t.storeNameEn, ltr: true })}
        {F({ name: "bioAr", label: t.bioAr, area: true })}
        {F({ name: "bioEn", label: t.bioEn, ltr: true, area: true })}
        {F({ name: "phone", label: t.phone, ltr: true })}
        {F({ name: "whatsapp", label: t.whatsappNum, ltr: true })}
        {F({ name: "addressAr", label: t.addressAr })}
        {F({ name: "addressEn", label: t.addressEn, ltr: true })}
        {F({ name: "area", label: t.area })}
        <MapPicker lang={lang} value={pin} onChange={setPin} error={fe("latitude") ?? fe("longitude")} />
      </div>
      <p className="text-xs text-stone-500">{t.storeReviewNote}</p>
      <button disabled={busy} className="btn-primary">{initial ? t.save : t.createStore}</button>
    </form>
  );
}
