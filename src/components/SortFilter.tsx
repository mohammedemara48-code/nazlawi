import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";

/** GET form for sort + price range (EGP). Keeps other params via hidden inputs. */
export default function SortFilter({ lang, action, values, keep = {} }: { lang: Locale; action: string; values: { sort?: string; minPrice?: number; maxPrice?: number }; keep?: Record<string, string | undefined> }) {
  const t = dict(lang);
  return (
    <form action={action} method="get" className="card flex flex-wrap items-end gap-3 p-3" aria-label={t.sortFilter}>
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="min-w-36 flex-1 text-sm">
        <span className="label">{t.sortBy}</span>
        <select name="sort" defaultValue={values.sort ?? "newest"} className="input py-2">
          <option value="newest">{t.sortNewest}</option>
          <option value="price_asc">{t.sortPriceAsc}</option>
          <option value="price_desc">{t.sortPriceDesc}</option>
        </select>
      </label>
      <label className="w-28 text-sm"><span className="label">{t.minPrice}</span>
        <input name="minPrice" type="number" min={0} step="any" inputMode="decimal" defaultValue={values.minPrice ?? ""} className="input py-2" dir="ltr" /></label>
      <label className="w-28 text-sm"><span className="label">{t.maxPrice}</span>
        <input name="maxPrice" type="number" min={0} step="any" inputMode="decimal" defaultValue={values.maxPrice ?? ""} className="input py-2" dir="ltr" /></label>
      <button className="btn-primary py-2">{t.apply}</button>
    </form>
  );
}
