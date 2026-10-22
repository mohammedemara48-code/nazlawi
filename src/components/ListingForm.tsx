"use client";
import { useState } from "react";
import type { Listing, ListingGroup } from "@prisma/client";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import { apiCall } from "./api-client";
import { PRICE_TYPES } from "@/lib/constants";
import { toMinor } from "@/lib/price";

type L = Omit<Listing, "searchText">;
type TextField = "nameAr" | "nameEn" | "descAr" | "descEn" | "phone" | "whatsapp";
export default function ListingForm({ lang, initial, groups }: { lang: Locale; initial?: L; groups: Pick<ListingGroup, "id" | "nameAr" | "nameEn">[] }) {
  const t = dict(lang);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<{ field: string; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [priceType, setPriceType] = useState<string>(initial?.priceType ?? "FIXED");
  const major = (m: number | null | undefined) => (m == null ? "" : String(m / 100));
  const fe = (f: string) => fields.find((x) => x.field === f)?.message;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null); setFields([]);
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const onReq = fd.priceType === "ON_REQUEST";
    const priceMinor = onReq || !fd.price ? null : toMinor(fd.price);
    const oldPriceMinor = onReq || !fd.oldPrice ? null : toMinor(fd.oldPrice);
    const bad = [["priceMinor", priceMinor], ["oldPriceMinor", oldPriceMinor]].filter(([, v]) => Number.isNaN(v)).map(([f]) => ({ field: f as string, message: t.invalidAmount }));
    if (bad.length) { setBusy(false); setFields(bad); setErr(t.invalidAmount); return; }
    const { price: _p, oldPrice: _o, ...rest } = fd; void _p; void _o;
    const body = { ...rest, priceMinor, oldPriceMinor, currency: "EGP", unitAr: fd.unitAr ?? "", unitEn: fd.unitEn ?? "", available: fd.available === "on", groupId: fd.groupId || null, phone: fd.phone || undefined };
    const r = await apiCall<{ listing: { id: string } }>(initial ? `/api/listings/${initial.id}` : "/api/listings", lang, { method: initial ? "PATCH" : "POST", body });
    setBusy(false);
    if (!r.ok) { setErr(r.error); setFields(r.details); return; }
    window.location.href = href(lang, initial ? "/dashboard" : `/dashboard/edit/${r.data.listing.id}`);
  }
  const F = ({ name, label, ltr, area }: { name: TextField; label: string; ltr?: boolean; area?: boolean }) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {area
        ? <textarea id={name} name={name} rows={3} className="input" dir={ltr ? "ltr" : "rtl"} defaultValue={initial?.[name] ?? ""} />
        : <input id={name} name={name} className="input" dir={ltr ? "ltr" : "rtl"} defaultValue={initial?.[name] ?? ""} />}
      {fe(name) && <p className="mt-1 text-xs text-red-600">{fe(name)}</p>}
    </div>
  );
  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-4 p-6" noValidate>
      <h1 className="font-serif text-3xl font-bold">{initial ? t.editListing : t.addListing}</h1>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {F({ name: "nameAr", label: t.nameAr })}
        {F({ name: "nameEn", label: t.nameEn, ltr: true })}
        {F({ name: "descAr", label: t.descAr, area: true })}
        {F({ name: "descEn", label: t.descEn, ltr: true, area: true })}
        {F({ name: "phone", label: t.phone, ltr: true })}
        {F({ name: "whatsapp", label: t.whatsappNum, ltr: true })}
        <div>
          <label className="label" htmlFor="groupId">{t.group}</label>
          <select id="groupId" name="groupId" className="input" defaultValue={initial?.groupId ?? ""}>
            <option value="">{t.noGroup}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{lang === "en" ? g.nameEn : g.nameAr}</option>)}
          </select>
        </div>
      </div>
      <fieldset className="rounded-2xl border border-stone-200 p-4">
        <legend className="px-1 text-sm font-semibold">{t.price}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priceType">{t.priceType}</label>
            <select id="priceType" name="priceType" className="input" value={priceType} onChange={(e) => setPriceType(e.target.value)} required>
              {PRICE_TYPES.map((p) => <option key={p} value={p}>{t.priceTypes[p]}</option>)}
            </select>
          </div>
          {priceType !== "ON_REQUEST" && (<>
            <div>
              <label className="label" htmlFor="price">{t.priceEgp}</label>
              <input id="price" name="price" inputMode="decimal" dir="ltr" className="input" defaultValue={major(initial?.priceMinor)} aria-invalid={!!fe("priceMinor")} />
              {fe("priceMinor") && <p className="mt-1 text-xs text-red-600">{fe("priceMinor")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="oldPrice">{t.oldPrice}</label>
              <input id="oldPrice" name="oldPrice" inputMode="decimal" dir="ltr" className="input" defaultValue={major(initial?.oldPriceMinor)} aria-invalid={!!fe("oldPriceMinor")} />
              {fe("oldPriceMinor") && <p className="mt-1 text-xs text-red-600">{fe("oldPriceMinor")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="unitAr">{t.unitAr}</label>
              <input id="unitAr" name="unitAr" className="input" defaultValue={initial?.unitAr ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="unitEn">{t.unitEn}</label>
              <input id="unitEn" name="unitEn" dir="ltr" className="input" defaultValue={initial?.unitEn ?? ""} />
            </div>
          </>)}
        </div>
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" name="available" defaultChecked={initial?.available ?? true} /> {t.availability}</label>
      <p className="text-xs text-stone-500">{t.pendingNote}</p>
      {!initial && <p className="text-xs text-stone-500">{t.saveFirst}</p>}
      <div className="flex gap-2">
        <button disabled={busy} aria-busy={busy} className="btn-primary">{busy ? t.loading : t.save}</button>
        <a href={href(lang, "/dashboard")} className="btn-outline">{t.cancel}</a>
      </div>
    </form>
  );
}
