import { UNIT_LABELS, type Locale, type Unit } from "./constants";

export type Priced = { priceType: string; priceMinor: number | null; oldPriceMinor?: number | null; currency: string; unitAr?: string; unitEn?: string; unit?: string | null };

/** "١٥٠ ج.م" / "EGP 150" (no decimals when whole pounds). */
export function formatMoney(minor: number, currency: string, lang: Locale) {
  const major = minor / 100;
  const digits = Number.isInteger(major) ? 0 : 2;
  if (lang === "en") return `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major)}`;
  const n = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major);
  return `${n} ${currency === "EGP" ? "ج.م" : currency}`;
}

/** Structured price for display: main label, optional old price and discount %. */
export function formatPrice(p: Priced, lang: Locale) {
  const code = p.unit && p.unit in UNIT_LABELS ? UNIT_LABELS[p.unit as Unit][lang] : null;
  const unit = code ?? (lang === "en" ? p.unitEn : p.unitAr)?.trim();
  const withUnit = (s: string) => (unit ? `${s} / ${unit}` : s);
  if (p.priceType === "ON_REQUEST" || p.priceMinor == null) {
    const label = p.priceType === "NEGOTIABLE" ? (lang === "en" ? "Negotiable" : "قابل للتفاوض") : lang === "en" ? "Price on request" : "السعر عند الطلب";
    return { main: label, old: null, discountPct: null, hasAmount: false };
  }
  const money = formatMoney(p.priceMinor, p.currency, lang);
  const main =
    p.priceType === "FROM" ? (lang === "en" ? `From ${money}` : `يبدأ من ${money}`)
    : p.priceType === "NEGOTIABLE" ? (lang === "en" ? `${money} (negotiable)` : `${money} (قابل للتفاوض)`)
    : money;
  const old = p.oldPriceMinor && p.oldPriceMinor > p.priceMinor ? formatMoney(p.oldPriceMinor, p.currency, lang) : null;
  const discountPct = old ? Math.round((1 - p.priceMinor / p.oldPriceMinor!) * 100) : null;
  return { main: withUnit(main), old, discountPct, hasAmount: true };
}

/** Parses a user-entered major amount ("150", "12.5", "١٥٠") into minor units, or null. */
export function toMinor(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === "") return null;
  const s = String(input).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٫,]/g, ".").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
