export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const CATEGORIES = ["groceries", "clothing", "construction", "rides", "transport", "medical", "crafts", "families", "events"] as const;
export type Category = (typeof CATEGORIES)[number];
export const MEDICAL_SUBS = ["doctors", "pharmacies", "labs"] as const;
/** Crafts (مهن): fixed trades + "other" with a provider-typed craft name (Store.craftName). */
export const CRAFT_SUBS = ["electrician", "plumber", "carpenter", "plastering", "gypsum", "other_craft"] as const;
export const SUBCATEGORIES: Partial<Record<string, readonly string[]>> = { medical: MEDICAL_SUBS, crafts: CRAFT_SUBS };
export const ALL_SUBS = [...MEDICAL_SUBS, ...CRAFT_SUBS] as const;
export const subsFor = (category?: string | null): readonly string[] => (category && SUBCATEGORIES[category]) || [];
/** Event invitations timeline limits. */
export const POST_CAPTION_MAX = 500;
export const COMMENT_MAX = 300;
export const REPORT_REASON_MAX = 200;
export const POSTS_PER_DAY = 5;
export const POSTS_PAGE_SIZE = 10;
export const ROLES = ["RESIDENT", "PROVIDER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const STATUSES = ["PENDING", "APPROVED", "HIDDEN"] as const;
export type Status = (typeof STATUSES)[number];
export const AVAILABILITY_CATEGORIES: readonly string[] = ["rides", "transport"];
export const SESSION_COOKIE = "nz_session";
export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const VIDEO_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const PROMOTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];
export const MAX_FEATURED = 3;
export const PRICE_TYPES = ["FIXED", "FROM", "NEGOTIABLE", "ON_REQUEST"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const CURRENCIES = ["EGP"] as const;
export const MAX_PRICE_MINOR = 10_000_000_000; // 100M EGP
export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

/** Product units (merchant catalog). Labels: [ar, en, ar "per", en "per"]. */
export const UNITS = ["piece", "kg", "gram", "liter", "box", "carton", "pack", "dozen"] as const;
export type Unit = (typeof UNITS)[number];
export const UNIT_LABELS: Record<Unit, { ar: string; en: string }> = {
  piece: { ar: "القطعة", en: "piece" },
  kg: { ar: "الكيلو", en: "kg" },
  gram: { ar: "الجرام", en: "gram" },
  liter: { ar: "اللتر", en: "liter" },
  box: { ar: "العلبة", en: "box" },
  carton: { ar: "الكرتونة", en: "carton" },
  pack: { ar: "العبوة", en: "pack" },
  dozen: { ar: "الدستة", en: "dozen" },
};
export const MAX_SECTIONS = 30;
export const MAX_PRODUCTS = 500;
