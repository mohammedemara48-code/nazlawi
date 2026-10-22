"use client";
import { useMemo, useState } from "react";
import { UNIT_LABELS, type Locale, type Unit } from "@/lib/constants";
import { formatMoney } from "@/lib/price";
import { apiCall } from "@/components/api-client";
import ProductForm from "./ProductForm";
import { OTHER, type MProduct, type MSection } from "./types";

const T = {
  ar: { add: "إضافة منتج", other: "أخرى", empty: "لسه مفيش منتجات في متجرك", emptyHint: "ابدأ بإضافة أول منتج: صورة، اسم، سعر ووحدة — ويظهر للزباين فوراً.", tipSections: "نصيحة: اعمل أقسام (زي ألبان، بيض، مشروبات) من تبويب «الأقسام» علشان المتجر يبقى منظم.",
    inStock: "متوفر", out: "غير متوفر", feature: "تمييز (يظهر تحت اسم المتجر)", unfeature: "إلغاء التمييز", edit: "تعديل", price: "السعر", save: "حفظ", featuredHint: "★ المنتجات المميزة (حتى ٣) بتظهر تحت اسم متجرك في صفحة القسم.", hidden: "مخفي بواسطة الإدارة", per: "/", search: "ابحث في منتجاتك…", count: (n: number) => `${n} منتج` },
  en: { add: "Add product", other: "Other", empty: "No products in your store yet", emptyHint: "Add your first product: photo, name, price and unit — it's visible to customers right away.", tipSections: "Tip: create sections (Dairy, Eggs, Drinks…) in the “Sections” tab to keep your store organized.",
    inStock: "In stock", out: "Out of stock", feature: "Feature (shown under your store name)", unfeature: "Unfeature", edit: "Edit", price: "Price", save: "Save", featuredHint: "★ Featured products (up to 3) appear under your store name on the category page.", hidden: "Hidden by admin", per: "/", search: "Search your products…", count: (n: number) => `${n} products` },
};

export default function ProductsTab({ lang, storeId, initialProducts, initialSections }: { lang: Locale; storeId: string; initialProducts: MProduct[]; initialSections: MSection[] }) {
  const t = T[lang];
  const [products, setProducts] = useState(initialProducts);
  const [sections, setSections] = useState(initialSections);
  const [editing, setEditing] = useState<MProduct | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const f = q.trim().toLowerCase();
    const list = f ? products.filter((p) => `${p.nameAr} ${p.nameEn}`.toLowerCase().includes(f)) : products;
    const out = sections.map((s) => ({ id: s.id, name: lang === "en" ? s.nameEn || s.nameAr : s.nameAr, items: list.filter((p) => p.groupId === s.id) }));
    out.push({ id: OTHER, name: t.other, items: list.filter((p) => !p.groupId) });
    return out.filter((g) => g.items.length);
  }, [products, sections, q, lang, t.other]);

  const replace = (p: MProduct) => setProducts((all) => all.some((x) => x.id === p.id) ? all.map((x) => (x.id === p.id ? p : x)) : [...all, p]);
  async function quick(p: MProduct, body: Record<string, unknown>) {
    setErr(null);
    const r = await apiCall<{ product: MProduct }>(`/api/products/${p.id}/quick`, lang, { method: "PATCH", body });
    if (!r.ok) { setErr(r.error); return false; }
    // featured positions of other products may shift: refresh from server
    if ("featured" in body) {
      const all = await apiCall<{ products: MProduct[] }>(`/api/stores/${storeId}/products`, lang);
      if (all.ok) setProducts(all.data.products);
    } else replace(r.data.product);
    return true;
  }

  return (
    <div className="space-y-4 pb-24">
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {products.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-4xl" aria-hidden>🛒</p>
          <h2 className="text-lg font-bold">{t.empty}</h2>
          <p className="text-sm text-stone-600">{t.emptyHint}</p>
          {sections.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{t.tipSections}</p>}
          <button type="button" onClick={() => setEditing("new")} className="btn-primary">+ {t.add}</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="input flex-1" />
            <span className="shrink-0 text-xs text-stone-500">{t.count(products.length)}</span>
          </div>
          <p className="text-xs text-stone-500">{t.featuredHint}</p>
          {groups.map((g) => (
            <section key={g.id} className="space-y-2">
              <h3 className="px-1 text-sm font-bold text-stone-600">{g.name} <span className="font-normal text-stone-400">({g.items.length})</span></h3>
              <ul className="card divide-y divide-stone-100 overflow-hidden">
                {g.items.map((p) => <Row key={p.id} p={p} lang={lang} t={t} onQuick={quick} onEdit={() => setEditing(p)} />)}
              </ul>
            </section>
          ))}
        </>
      )}
      <button type="button" onClick={() => setEditing("new")}
        className="fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-full bg-[#C0532F] px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-[#C0532F]/30 hover:bg-[#a9472a] focus:outline-none focus:ring-4 focus:ring-[#C0532F]/30">
        <span className="text-xl leading-none">+</span> {lang === "en" ? "Add product" : "إضافة منتج"}
      </button>
      {editing && (
        <ProductForm lang={lang} storeId={storeId} product={editing === "new" ? null : editing} sections={sections}
          onSectionsChange={setSections}
          onSaved={(p) => replace(p)}
          onDeleted={(id) => setProducts((all) => all.filter((x) => x.id !== id))}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Row({ p, lang, t, onQuick, onEdit }: { p: MProduct; lang: Locale; t: (typeof T)["ar"]; onQuick: (p: MProduct, b: Record<string, unknown>) => Promise<boolean>; onEdit: () => void }) {
  const [editPrice, setEditPrice] = useState(false);
  const [price, setPrice] = useState(p.priceMinor != null ? String(p.priceMinor / 100) : "");
  const [busy, setBusy] = useState(false);
  const name = lang === "en" ? p.nameEn || p.nameAr : p.nameAr;
  const unit = p.unit && p.unit in UNIT_LABELS ? UNIT_LABELS[p.unit as Unit][lang] : (lang === "en" ? p.unitEn : p.unitAr);
  const img = p.images[0];
  async function savePrice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await onQuick(p, { price: price.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٫,]/g, ".") });
    setBusy(false);
    if (ok) setEditPrice(false);
  }
  const featured = p.featuredPosition != null;
  return (
    <li className={`flex items-center gap-3 p-3 ${p.available ? "" : "bg-stone-50"}`}>
      <button type="button" onClick={onEdit} className="shrink-0" aria-label={`${t.edit}: ${name}`}>
        {img ? <img src={`/api/uploads/${img.key}`} alt="" className="h-14 w-14 rounded-xl object-cover" />
          : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F2D49B]/50 text-2xl">🛒</span>}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="block w-full truncate text-start font-semibold">{name}</button>
        {p.status === "HIDDEN" && <span className="text-[11px] text-red-700">{t.hidden}</span>}
        {editPrice ? (
          <form onSubmit={savePrice} className="mt-1 flex items-center gap-1">
            <input autoFocus inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={t.price} className="input h-8 w-24 px-2 py-1 text-sm" dir="ltr" />
            <button disabled={busy} className="btn-primary h-8 px-3 py-0 text-xs">{t.save}</button>
            <button type="button" onClick={() => setEditPrice(false)} className="px-1 text-stone-400" aria-label="✕">✕</button>
          </form>
        ) : (
          <button type="button" onClick={() => setEditPrice(true)} className="mt-0.5 text-sm font-bold text-[#C0532F] underline decoration-dotted underline-offset-4" title={t.price}>
            {p.priceMinor != null ? formatMoney(p.priceMinor, "EGP", lang) : "—"}{unit ? <span className="font-normal text-stone-500"> {t.per} {unit}</span> : null}
          </button>
        )}
      </div>
      <button type="button" onClick={() => onQuick(p, { featured: !featured })} aria-pressed={featured} title={featured ? t.unfeature : t.feature} aria-label={featured ? t.unfeature : t.feature}
        className={`shrink-0 rounded-full p-1.5 text-xl ${featured ? "text-amber-500" : "text-stone-300 hover:text-amber-400"}`}>★</button>
      <label className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5" title={p.available ? t.inStock : t.out}>
        <input type="checkbox" role="switch" className="peer sr-only" checked={p.available} onChange={(e) => onQuick(p, { inStock: e.target.checked })} aria-label={t.inStock} />
        <span className="relative h-6 w-11 rounded-full bg-stone-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
        <span className={`text-[10px] ${p.available ? "text-emerald-700" : "text-stone-500"}`}>{p.available ? t.inStock : t.out}</span>
      </label>
    </li>
  );
}
