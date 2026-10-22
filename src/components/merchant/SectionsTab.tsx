"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { apiCall } from "@/components/api-client";
import type { MSection } from "./types";

const T = {
  ar: { title: "أقسام متجرك", hint: "الأقسام بتنظم منتجاتك وبتظهر للزباين كتبويبات في صفحة المتجر. رتّبها بالسحب أو بالأسهم.", add: "إضافة قسم", placeholder: "اسم القسم، مثال: ألبان", nameEn: "بالإنجليزي (اختياري)", rename: "تعديل", save: "حفظ", cancel: "إلغاء", del: "حذف", up: "لفوق", down: "لتحت", empty: "مفيش أقسام لسه. أمثلة للبقالة: ألبان، بيض، جبن، مكرونة، زيوت وسمن، مشروبات.", confirm: (n: string, c: number) => `حذف قسم «${n}»؟${c ? ` المنتجات اللي فيه (${c}) هتتنقل لـ «أخرى».` : ""}`, products: (n: number) => `${n} منتج`, drag: "اسحب لإعادة الترتيب" },
  en: { title: "Your store sections", hint: "Sections organize your products and appear as tabs on your store page. Reorder by dragging or with the arrows.", add: "Add section", placeholder: "Section name (Arabic), e.g. ألبان", nameEn: "English (optional)", rename: "Rename", save: "Save", cancel: "Cancel", del: "Delete", up: "Move up", down: "Move down", empty: "No sections yet. Grocery examples: Dairy, Eggs, Cheese, Pasta, Oils & ghee, Drinks.", confirm: (n: string, c: number) => `Delete section “${n}”?${c ? ` Its ${c} products will move to “Other”.` : ""}`, products: (n: number) => `${n} products`, drag: "Drag to reorder" },
};

export default function SectionsTab({ lang, storeId, initial }: { lang: Locale; storeId: string; initial: MSection[] }) {
  const t = T[lang];
  const [list, setList] = useState(initial);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ id: string; nameAr: string; nameEn: string } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) return;
    setBusy(true); setErr(null);
    const r = await apiCall<{ section: MSection }>(`/api/stores/${storeId}/sections`, lang, { body: { nameAr, nameEn } });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setList((l) => [...l, { ...r.data.section, productCount: 0 }]);
    setNameAr(""); setNameEn("");
  }
  async function persist(next: MSection[]) {
    const prev = list;
    setList(next);
    const r = await apiCall(`/api/stores/${storeId}/sections/reorder`, lang, { body: { ids: next.map((s) => s.id) } });
    if (!r.ok) { setErr(r.error); setList(prev); }
  }
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  };
  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const r = await apiCall<{ section: MSection }>(`/api/sections/${edit.id}`, lang, { method: "PATCH", body: { nameAr: edit.nameAr, nameEn: edit.nameEn } });
    if (!r.ok) return setErr(r.error);
    setList((l) => l.map((s) => (s.id === edit.id ? { ...s, ...r.data.section } : s)));
    setEdit(null);
  }
  async function del(s: MSection) {
    if (!confirm(t.confirm(s.nameAr, s.productCount ?? 0))) return;
    const r = await apiCall(`/api/sections/${s.id}`, lang, { method: "DELETE" });
    if (!r.ok) return setErr(r.error);
    setList((l) => l.filter((x) => x.id !== s.id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t.title}</h2>
        <p className="text-sm text-stone-600">{t.hint}</p>
      </div>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <form onSubmit={add} className="card grid gap-2 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" placeholder={t.placeholder} value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={40} aria-label={t.placeholder} />
        <input className="input" placeholder={t.nameEn} value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={40} dir="ltr" aria-label={t.nameEn} />
        <button disabled={busy || !nameAr.trim()} className="btn-primary">+ {t.add}</button>
      </form>
      {list.length === 0 ? <p className="card p-6 text-center text-sm text-stone-500">{t.empty}</p> : (
        <ul className="card divide-y divide-stone-100 overflow-hidden">
          {list.map((s, i) => (
            <li key={s.id} draggable={!edit} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag == null || drag === i) return; const next = [...list]; const [m] = next.splice(drag, 1); next.splice(i, 0, m); setDrag(null); persist(next); }}
              className={`flex items-center gap-2 p-3 ${drag === i ? "bg-amber-50" : ""}`}>
              <span className="cursor-grab select-none px-1 text-stone-400" title={t.drag} aria-hidden>⠿</span>
              {edit?.id === s.id ? (
                <form onSubmit={rename} className="flex flex-1 flex-wrap gap-2">
                  <input autoFocus className="input h-9 min-w-0 flex-1" value={edit.nameAr} onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })} maxLength={40} />
                  <input className="input h-9 min-w-0 flex-1" dir="ltr" placeholder={t.nameEn} value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} maxLength={40} />
                  <button className="btn-primary h-9 py-0 text-sm">{t.save}</button>
                  <button type="button" onClick={() => setEdit(null)} className="btn-outline h-9 py-0 text-sm">{t.cancel}</button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.nameAr}{s.nameEn && s.nameEn !== s.nameAr ? <span className="ms-2 text-xs font-normal text-stone-400" dir="ltr">{s.nameEn}</span> : null}</p>
                    <p className="text-xs text-stone-500">{t.products(s.productCount ?? 0)}</p>
                  </div>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 text-stone-500 disabled:opacity-30" aria-label={t.up}>▲</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="rounded-lg p-2 text-stone-500 disabled:opacity-30" aria-label={t.down}>▼</button>
                  <button type="button" onClick={() => setEdit({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn === s.nameAr ? "" : s.nameEn })} className="rounded-lg px-2 py-1 text-sm text-[#C0532F]">{t.rename}</button>
                  <button type="button" onClick={() => del(s)} className="rounded-lg px-2 py-1 text-sm text-red-700">{t.del}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
