"use client";
import { useEffect, useRef, useState } from "react";
import { UNITS, UNIT_LABELS, type Locale } from "@/lib/constants";
import { apiCall } from "@/components/api-client";
import { uploadTo } from "@/components/upload-client";
import { compressImage } from "./image-compress";
import type { MProduct, MSection } from "./types";

const T = {
  ar: { newTitle: "إضافة منتج", editTitle: "تعديل المنتج", photo: "صورة المنتج", gallery: "من المعرض", camera: "الكاميرا", change: "تغيير الصورة", name: "اسم المنتج", nameEn: "الاسم بالإنجليزي (اختياري)", section: "القسم", other: "أخرى (بدون قسم)", newSection: "+ قسم جديد…", newSectionName: "اسم القسم الجديد", addSection: "إضافة", price: "السعر (جنيه)", unit: "الوحدة", oldPrice: "السعر قبل الخصم (اختياري)", desc: "وصف (اختياري)", descEn: "وصف بالإنجليزي (اختياري)", english: "بيانات بالإنجليزي (اختياري)", inStock: "متوفر حالياً", save: "حفظ", saveAnother: "حفظ وإضافة منتج آخر", cancel: "إلغاء", del: "حذف المنتج", confirmDel: "متأكد إنك عايز تحذف المنتج؟", saving: "جاري الحفظ…", uploading: "جاري رفع الصورة…", saved: "تم الحفظ ✓", photoFailed: "المنتج اتحفظ، لكن الصورة ما اترفعتش:", per: "لكل" },
  en: { newTitle: "Add product", editTitle: "Edit product", photo: "Product photo", gallery: "Gallery", camera: "Camera", change: "Change photo", name: "Product name (Arabic)", nameEn: "English name (optional)", section: "Section", other: "Other (no section)", newSection: "+ New section…", newSectionName: "New section name", addSection: "Add", price: "Price (EGP)", unit: "Unit", oldPrice: "Price before discount (optional)", desc: "Description (optional)", descEn: "English description (optional)", english: "English details (optional)", inStock: "In stock", save: "Save", saveAnother: "Save & add another", cancel: "Cancel", del: "Delete product", confirmDel: "Delete this product?", saving: "Saving…", uploading: "Uploading photo…", saved: "Saved ✓", photoFailed: "The product was saved, but the photo failed:", per: "per" },
};
const NEW = "__new";
const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٫,]/g, ".").trim();

/** Single-screen add/edit product sheet (mobile-first). */
export default function ProductForm({ lang, storeId, product, sections, onSectionsChange, onSaved, onDeleted, onClose }: {
  lang: Locale; storeId: string; product: MProduct | null; sections: MSection[];
  onSectionsChange: (s: MSection[]) => void; onSaved: (p: MProduct) => void; onDeleted: (id: string) => void; onClose: () => void;
}) {
  const t = T[lang];
  const first = useRef<HTMLInputElement>(null);
  const empty = { nameAr: "", nameEn: "", descAr: "", descEn: "", price: "", oldPrice: "", unit: "piece", inStock: true, sectionId: "" };
  const fromProduct = (p: MProduct) => ({ nameAr: p.nameAr, nameEn: p.nameEn === p.nameAr ? "" : p.nameEn, descAr: p.descAr, descEn: p.descEn, price: p.priceMinor != null ? String(p.priceMinor / 100) : "", oldPrice: p.oldPriceMinor != null ? String(p.oldPriceMinor / 100) : "", unit: p.unit ?? "piece", inStock: p.available, sectionId: p.groupId ?? "" });
  const [f, setF] = useState(product ? fromProduct(product) : empty);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.images[0] ? `/api/uploads/${product.images[0].key}` : null);
  const [newSec, setNewSec] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<{ field: string; message: string }[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const fe = (k: string) => fields.find((x) => x.field === k)?.message;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));

  useEffect(() => { first.current?.focus(); const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", esc); document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; }; }, [onClose]);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    const c = await compressImage(raw);
    setFile(c);
    setPreview(URL.createObjectURL(c));
  }
  async function addSection() {
    const name = (newSec ?? "").trim();
    if (!name) return;
    const r = await apiCall<{ section: MSection }>(`/api/stores/${storeId}/sections`, lang, { body: { nameAr: name } });
    if (!r.ok) { setErr(r.error); return; }
    onSectionsChange([...sections, r.data.section]);
    set("sectionId", r.data.section.id);
    setNewSec(null);
  }
  async function save(another: boolean) {
    setErr(null); setFields([]); setBusy(t.saving);
    const body = { nameAr: f.nameAr, nameEn: f.nameEn, descAr: f.descAr, descEn: f.descEn, price: digits(f.price), oldPrice: digits(f.oldPrice) || null, unit: f.unit, inStock: f.inStock, sectionId: f.sectionId || null };
    const r = product
      ? await apiCall<{ product: MProduct }>(`/api/products/${product.id}`, lang, { method: "PATCH", body })
      : await apiCall<{ product: MProduct }>(`/api/stores/${storeId}/products`, lang, { body });
    if (!r.ok) { setBusy(null); setErr(r.error); setFields(r.details); return; }
    let saved = r.data.product;
    if (file) {
      setBusy(t.uploading);
      const up = await uploadTo<{ image: { id: string; key: string } }>(`/api/listings/${saved.id}/images`, lang, file, { kind: "image", target: { listingId: saved.id } });
      if (!up.ok) { onSaved(saved); setBusy(null); setErr(`${t.photoFailed} ${up.error}`); return; }
      // The new photo replaces the main photo only (extra photos from the product page are kept).
      const main = saved.images[0];
      if (main) await apiCall(`/api/listings/${saved.id}/images/${main.id}`, lang, { method: "DELETE" });
      const fresh = await apiCall<{ product: MProduct }>(`/api/products/${saved.id}`, lang);
      saved = fresh.ok ? fresh.data.product : { ...saved, images: [up.data.image] };
    }
    onSaved(saved);
    setBusy(null);
    if (another) {
      setF({ ...empty, sectionId: f.sectionId, unit: f.unit });
      setFile(null); setPreview(null);
      setFlash(t.saved);
      setTimeout(() => setFlash(null), 2000);
      first.current?.focus();
    } else onClose();
  }
  async function remove() {
    if (!product || !confirm(t.confirmDel)) return;
    setBusy(t.saving);
    const r = await apiCall(`/api/products/${product.id}`, lang, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    onDeleted(product.id);
    onClose();
  }
  const err1 = (k: string) => fe(k) && <p className="mt-1 text-xs text-red-600">{fe(k)}</p>;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pf-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[92vh] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 id="pf-title" className="text-lg font-bold">{product ? t.editTitle : t.newTitle}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label={t.cancel}>✕</button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {flash && <p role="status" className="rounded-xl bg-emerald-50 p-2 text-center text-sm font-semibold text-emerald-800">{flash}</p>}
          {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          <div>
            <p className="label">{t.photo}</p>
            <div className="flex items-center gap-3">
              {preview ? <img src={preview} alt="" className="h-24 w-24 rounded-2xl object-cover ring-1 ring-stone-200" />
                : <span className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 text-3xl text-stone-400">📷</span>}
              <div className="flex flex-col gap-2">
                <label className="btn-outline cursor-pointer text-sm">🖼️ {preview ? t.change : t.gallery}<input type="file" accept="image/*" className="hidden" onChange={pick} /></label>
                <label className="btn-outline cursor-pointer text-sm">📷 {t.camera}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} /></label>
              </div>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pf-name">{t.name} *</label>
            <input ref={first} id="pf-name" className="input" value={f.nameAr} onChange={(e) => set("nameAr", e.target.value)} maxLength={100} dir="auto" />
            {err1("nameAr")}
          </div>
          <div>
            <label className="label" htmlFor="pf-sec">{t.section}</label>
            {newSec === null ? (
              <select id="pf-sec" className="input" value={f.sectionId} onChange={(e) => (e.target.value === NEW ? setNewSec("") : set("sectionId", e.target.value))}>
                <option value="">{t.other}</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{lang === "en" ? s.nameEn || s.nameAr : s.nameAr}</option>)}
                <option value={NEW}>{t.newSection}</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input autoFocus className="input flex-1" placeholder={t.newSectionName} value={newSec} onChange={(e) => setNewSec(e.target.value)} maxLength={40}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSection(); } }} />
                <button type="button" onClick={addSection} className="btn-primary text-sm">{t.addSection}</button>
                <button type="button" onClick={() => setNewSec(null)} className="btn-outline text-sm">{t.cancel}</button>
              </div>
            )}
            {err1("sectionId")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pf-price">{t.price} *</label>
              <input id="pf-price" className="input" inputMode="decimal" dir="ltr" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
              {err1("price")}
            </div>
            <div>
              <label className="label" htmlFor="pf-unit">{t.unit}</label>
              <select id="pf-unit" className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{t.per} {UNIT_LABELS[u][lang]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pf-old">{t.oldPrice}</label>
            <input id="pf-old" className="input" inputMode="decimal" dir="ltr" value={f.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} placeholder="—" />
            {err1("oldPrice")}
          </div>
          <div>
            <label className="label" htmlFor="pf-desc">{t.desc}</label>
            <textarea id="pf-desc" rows={2} className="input" value={f.descAr} onChange={(e) => set("descAr", e.target.value)} maxLength={1000} dir="auto" />
          </div>
          <details className="rounded-xl bg-stone-50 p-3" open={!!(f.nameEn || f.descEn)}>
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">{t.english}</summary>
            <div className="mt-3 space-y-3">
              <div><label className="label" htmlFor="pf-en">{t.nameEn}</label><input id="pf-en" className="input" dir="ltr" value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={100} /></div>
              <div><label className="label" htmlFor="pf-den">{t.descEn}</label><textarea id="pf-den" rows={2} className="input" dir="ltr" value={f.descEn} onChange={(e) => set("descEn", e.target.value)} maxLength={1000} /></div>
            </div>
          </details>
          <label className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
            <span className="font-semibold">{t.inStock}</span>
            <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={f.inStock} onChange={(e) => set("inStock", e.target.checked)} />
          </label>
          {product && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={`${lang === "en" ? "/en" : ""}/dashboard/edit/${product.id}`} className="text-sm font-semibold text-[#C0532F] underline">{lang === "en" ? "More photos (up to 4) & product video" : "صور إضافية (حتى ٤) وفيديو المنتج"}</a>
              <button type="button" onClick={remove} className="text-sm text-red-700 underline">{t.del}</button>
            </div>
          )}
        </div>
        <footer className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!product && <button type="button" disabled={!!busy} onClick={() => save(true)} className="btn-outline text-sm">{t.saveAnother}</button>}
          <button disabled={!!busy} className={`btn-primary ${product ? "col-span-2" : ""}`}>{busy ?? t.save}</button>
        </footer>
      </form>
    </div>
  );
}
