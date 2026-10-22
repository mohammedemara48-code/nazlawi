/** Normalize Arabic/English text for search (lowercase, unify alef/yaa/taa marbuta, strip diacritics). */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}
