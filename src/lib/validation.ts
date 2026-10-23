import { z } from "zod";
import { UNITS, CATEGORIES, CURRENCIES, MAX_PRICE_MINOR, ALL_SUBS, COMMENT_MAX, POST_CAPTION_MAX, REPORT_REASON_MAX, subsFor, PRICE_TYPES, PROMOTION_STATUSES, SORTS, ROLES, STATUSES, USER_STATUSES, VIDEO_STATUSES } from "./constants";

// Messages are bilingual "ar|en"; errors.ts picks the right half.
const m = (ar: string, en: string) => `${ar}|${en}`;

// Global fallback so built-in Zod messages ("Required", type errors...) are bilingual too.
z.setErrorMap((issue, ctx) => {
  if (issue.code === "invalid_type" && issue.received === "undefined") return { message: m("هذا الحقل مطلوب", "This field is required") };
  if (issue.code === "invalid_type") return { message: m("نوع القيمة غير صحيح", "Invalid value type") };
  if (issue.code === "too_big") return { message: m("القيمة طويلة جداً", "Value is too long") };
  if (issue.code === "too_small") return { message: m("القيمة قصيرة جداً", "Value is too short") };
  if (issue.code === "invalid_enum_value") return { message: m("القيمة غير مسموح بها", "Value not allowed") };
  return { message: ctx.defaultError.includes("|") ? ctx.defaultError : m("قيمة غير صحيحة", "Invalid value") };
});
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, m("رقم الهاتف غير صحيح", "Invalid phone number"));

export const signupSchema = z.object({
  name: z.string().trim().min(2, m("الاسم قصير جداً", "Name is too short")).max(80, m("الاسم طويل جداً", "Name is too long")),
  email: z.string().trim().toLowerCase().email(m("البريد الإلكتروني غير صحيح", "Invalid email")),
  password: z.string().min(8, m("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters")).max(128),
  lang: z.enum(["ar", "en"]).optional(),
  role: z.enum(["RESIDENT", "PROVIDER"], { message: m("نوع الحساب غير صحيح", "Invalid account type") }).default("RESIDENT"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(m("البريد الإلكتروني غير صحيح", "Invalid email")),
  password: z.string().min(1, m("أدخل كلمة المرور", "Enter your password")),
});

const sub = z.enum(ALL_SUBS, { message: m("التصنيف الفرعي غير صحيح", "Invalid subcategory") });
/** Sections with sub-types (medical, crafts) need one from their own list; "other_craft" needs a craft name. */
const medicalRule = (v: { category?: string; subcategory?: string | null }) => {
  const subs = subsFor(v.category);
  return !subs.length || (!!v.subcategory && subs.includes(v.subcategory));
};
const medicalMsg = { message: m("اختر نوع الخدمة", "Choose a service type"), path: ["subcategory"] };
const craftRule = (v: { category?: string; subcategory?: string | null; craftName?: string }) => v.category !== "crafts" || v.subcategory !== "other_craft" || !!v.craftName?.trim();
const craftMsg = { message: m("اكتب اسم المهنة", "Enter the craft name"), path: ["craftName"] };
const text = (max: number) => z.string().trim().max(max, m("النص طويل جداً", "Text is too long"));

/** Store = the provider's mini store. Category (section) is required at onboarding. */
const hhmm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, m("الوقت غير صحيح (مثال 09:00)", "Invalid time (e.g. 09:00)"));
/** Egyptian mobile → E.164 (+2010/11/12/15 + 8 digits). Accepts 01xxxxxxxxx, 201xxxxxxxxx, +201xxxxxxxxx, 00201…; Arabic digits too. */
export function toEgE164(raw: string): string | null {
  const d = raw.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\s\-()]/g, "").replace(/^00/, "+");
  const m1 = /^(?:\+?20|0)?(1[0125]\d{8})$/.exec(d);
  return m1 ? `+20${m1[1]}` : null;
}
export const egWhatsapp = z.string().transform((v, ctx) => {
  const e = toEgE164(v);
  if (!e) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: m("رقم واتساب مصري غير صحيح (مثال 01012345678)", "Invalid Egyptian WhatsApp number (e.g. 01012345678)") }); return z.NEVER; }
  return e;
});
const storeBase = z.object({
  category: z.enum(CATEGORIES, { message: m("اختر القسم", "Choose a section") }),
  subcategory: sub.nullish(),
  craftName: z.string().trim().max(40, m("اسم المهنة طويل جداً", "Craft name is too long")).default(""),
  nameAr: z.string().trim().min(2, m("اسم المتجر بالعربي مطلوب", "Arabic store name is required")).max(80),
  nameEn: z.string().trim().min(2, m("اسم المتجر بالإنجليزي مطلوب", "English store name is required")).max(80),
  bioAr: text(600).default(""),
  bioEn: text(600).default(""),
  phone,
  whatsapp: z.literal("").transform(() => null).or(egWhatsapp).nullish(),
  addressAr: text(200).default(""),
  addressEn: text(200).default(""),
  area: text(80).default(""),
  openTime: hhmm.nullish().or(z.literal("").transform(() => null)),
  closeTime: hhmm.nullish().or(z.literal("").transform(() => null)),
  hoursNoteAr: text(120).default(""),
  hoursNoteEn: text(120).default(""),
  latitude: z.coerce.number().min(-90, m("خط العرض غير صحيح", "Invalid latitude")).max(90, m("خط العرض غير صحيح", "Invalid latitude")).nullish(),
  longitude: z.coerce.number().min(-180, m("خط الطول غير صحيح", "Invalid longitude")).max(180, m("خط الطول غير صحيح", "Invalid longitude")).nullish(),
});
/** Shared map-pin fields (optional pin + short landmark). Both coordinates or neither. */
const lat = z.coerce.number().min(-90, m("خط العرض غير صحيح", "Invalid latitude")).max(90, m("خط العرض غير صحيح", "Invalid latitude")).nullish();
const lng = z.coerce.number().min(-180, m("خط الطول غير صحيح", "Invalid longitude")).max(180, m("خط الطول غير صحيح", "Invalid longitude")).nullish();
const landmark = (max = 120) => z.string().trim().max(max, m("العلامة المميزة طويلة جداً", "Landmark is too long")).default("");
export const pinFields = { latitude: lat, longitude: lng };
const coordsRule = (v: { latitude?: number | null; longitude?: number | null }) => (v.latitude == null) === (v.longitude == null);
const coordsMsg = { message: m("حدد الموقع على الخريطة كاملاً", "Set both latitude and longitude"), path: ["latitude"] };
export const storeCreateSchema = storeBase.refine(medicalRule, medicalMsg).refine(craftRule, craftMsg).refine(coordsRule, coordsMsg);
export const storeUpdateSchema = storeBase.partial().refine((v) => v.category === undefined || medicalRule(v), medicalMsg).refine(craftRule, craftMsg).refine(coordsRule, coordsMsg);

/** Listing = an ad/offer inside a store. Category comes from the store. */
const listingBase = z.object({
  storeId: z.string().cuid().optional(),
  ...pinFields,
  locationNote: landmark(),
  groupId: z.string().cuid().nullish(),
  nameAr: z.string().trim().min(2, m("الاسم بالعربي مطلوب", "Arabic name is required")).max(100),
  nameEn: z.string().trim().min(2, m("الاسم بالإنجليزي مطلوب", "English name is required")).max(100),
  descAr: text(1000).default(""),
  descEn: text(1000).default(""),
  phone: phone.optional(), // defaults to the store phone
  whatsapp: phone.nullish().or(z.literal("").transform(() => null)),
  available: z.boolean().default(true),
  // Price (minor units = piasters). priceType is required on create.
  priceType: z.enum(PRICE_TYPES, { message: m("اختر نوع السعر", "Choose a price type") }),
  priceMinor: z.number({ message: m("السعر لازم يكون رقم", "Price must be a number") }).int(m("السعر غير صحيح", "Invalid price"))
    .positive(m("السعر لازم يكون أكبر من صفر", "Price must be greater than zero")).max(MAX_PRICE_MINOR, m("السعر كبير جداً", "Price is too large")).nullish(),
  oldPriceMinor: z.number().int().positive().max(MAX_PRICE_MINOR).nullish(),
  currency: z.enum(CURRENCIES).default("EGP"),
  unitAr: text(30).default(""),
  unitEn: text(30).default(""),
});

type PriceFields = { priceType?: string; priceMinor?: number | null; oldPriceMinor?: number | null };
/** Shared price rules (also applied by the service to merged updates). Returns [field, message] or null. */
export function priceProblem(v: PriceFields): [string, string] | null {
  const needs = v.priceType === "FIXED" || v.priceType === "FROM";
  if (needs && !v.priceMinor) return ["priceMinor", m("السعر مطلوب لهذا النوع", "Price is required for this price type")];
  if (v.priceType === "ON_REQUEST" && (v.priceMinor || v.oldPriceMinor)) return ["priceMinor", m("السعر عند الطلب لا يحتوي على رقم", "\"On request\" can't have a price")];
  if (v.oldPriceMinor != null) {
    if (!v.priceMinor) return ["oldPriceMinor", m("السعر قبل الخصم يحتاج سعر حالي", "An old price needs a current price")];
    if (v.oldPriceMinor <= v.priceMinor) return ["oldPriceMinor", m("السعر بعد الخصم لازم يكون أقل من السعر الأصلي", "Discounted price must be lower than the original price")];
  }
  return null;
}
const priceRefine = (v: PriceFields, ctx: z.RefinementCtx) => {
  const p = priceProblem(v);
  if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [p[0]], message: p[1] });
};
export const listingCreateSchema = listingBase.superRefine(priceRefine).refine(coordsRule, coordsMsg);
export const listingUpdateSchema = listingBase.omit({ storeId: true }).partial().refine(coordsRule, coordsMsg);

export const featuredSchema = z.object({
  listingIds: z.array(z.string().cuid()).max(3, m("تقدر تختار 3 إعلانات مميزة كحد أقصى", "You can feature at most 3 listings"))
    .refine((a) => new Set(a).size === a.length, m("في إعلان مكرر", "Duplicate listing")),
});
export const groupSchema = z.object({
  nameAr: z.string().trim().min(1, m("اسم القسم مطلوب", "Section name is required")).max(40),
  nameEn: z.string().trim().min(1, m("اسم القسم مطلوب", "Section name is required")).max(40),
  position: z.number().int().min(0).max(100).optional(),
});
/** Optional major-unit amount from a query string; "" means "not set". */
const optMoney = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0).max(1e8).optional());
export const storeQuerySchema = z.object({
  sort: z.enum(SORTS).default("newest"),
  minPrice: optMoney,
  maxPrice: optMoney,
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.enum(ALL_SUBS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(10),
});
const priceQuery = {
  sort: z.enum(SORTS).default("newest"),
  minPrice: optMoney,
  maxPrice: optMoney,
};
export const storePageQuerySchema = z.object({
  ...priceQuery,
  group: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});
export const moderationSchema = z.object({ status: z.enum(STATUSES, { message: m("الحالة غير صحيحة", "Invalid status") }) });
export const videoStatusSchema = z.object({ status: z.enum(VIDEO_STATUSES, { message: m("الحالة غير صحيحة", "Invalid status") }) });
const date = z.coerce.date({ message: m("التاريخ غير صحيح", "Invalid date") });
export const promotionRequestSchema = z
  .object({
    targetType: z.enum(["LISTING", "STORE"], { message: m("نوع العرض غير صحيح", "Invalid promotion type") }),
    listingId: z.string().cuid().optional(),
    storeId: z.string().cuid().optional(),
    startsAt: date,
    endsAt: date,
    note: text(300).default(""),
  })
  .refine((v) => (v.targetType === "LISTING" ? !!v.listingId : !!v.storeId), { message: m("حدد الإعلان أو المتجر", "Choose a listing or store"), path: ["targetType"] });
export const promotionAdminSchema = z
  .object({
    status: z.enum(PROMOTION_STATUSES).optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    startsAt: date.optional(),
    endsAt: date.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: m("لا يوجد تغيير", "Nothing to change") });
export const adminListSchema = z.object({
  status: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const listQuerySchema = z.object({
  sort: z.enum(SORTS).default("newest"),
  minPrice: optMoney,
  maxPrice: optMoney,
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.enum(ALL_SUBS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const adminQuerySchema = listQuerySchema.extend({ status: z.enum(STATUSES).optional() });
export const passwordSchema = z.string().min(8, m("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters")).max(128);
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email(m("البريد الإلكتروني غير صحيح", "Invalid email")) });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifySchema = z.object({ token: z.string().min(20).max(200) });
const email = z.string().trim().toLowerCase().email(m("البريد الإلكتروني غير صحيح", "Invalid email")).max(254);
export const profileSchema = z.object({
  name: z.string().trim().min(2, m("الاسم قصير جداً", "Name is too short")).max(80, m("الاسم طويل جداً", "Name is too long")).optional(),
  phone: phone.nullish().or(z.literal("").transform(() => null)),
  locale: z.enum(["ar", "en"]).optional(),
  ...pinFields,
  addressNote: landmark(160).optional(),
}).refine(coordsRule, coordsMsg);
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
export const changeEmailSchema = z.object({ password: z.string().min(1).max(128), newEmail: email });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });
export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export const adminUserUpdateSchema = z
  .object({ role: z.enum(ROLES).optional(), status: z.enum(USER_STATUSES).optional(), verified: z.literal(true).optional() })
  .refine((v) => v.role || v.status || v.verified, { message: m("لا يوجد تغيير", "Nothing to change") });
export const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) });
export const statusSchema = z.object({ status: z.enum(STATUSES, { message: m("الحالة غير صحيحة", "Invalid status") }) });
export const availabilitySchema = z.object({ available: z.boolean() });

export type ListingInput = z.infer<typeof listingCreateSchema>;
export type StoreInput = z.infer<typeof storeCreateSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;

// ---------- Merchant catalog (sections + products) ----------
const nameAr = (max: number) => z.string().trim().min(1, m("الاسم بالعربي مطلوب", "Arabic name is required")).max(max, m("الاسم طويل جداً", "Name is too long"));
const optName = (max: number) => z.string().trim().max(max, m("الاسم طويل جداً", "Name is too long")).optional().default("");
export const sectionSchema = z.object({ nameAr: nameAr(40), nameEn: optName(40) });
export const sectionUpdateSchema = sectionSchema.partial();
export const reorderSchema = z.object({
  ids: z.array(z.string().cuid()).max(500).refine((a) => new Set(a).size === a.length, m("في عنصر مكرر", "Duplicate item")),
});
/** Money in major units (EGP), max 2 decimals → integer piasters. */
const moneyReq = () => z.coerce.number({ message: m("السعر لازم يكون رقم", "Price must be a number") })
    .positive(m("السعر لازم يكون أكبر من صفر", "Price must be greater than zero"))
    .max(MAX_PRICE_MINOR / 100, m("السعر كبير جداً", "Price is too large"))
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, m("السعر يقبل قرشين بعد العلامة بحد أقصى", "Use at most 2 decimals"))
    .transform((v) => Math.round(v * 100));
const moneyOpt = () => z.preprocess((v) => (v === "" || v == null ? null : v), moneyReq().nullable()).optional();
const productFields = {
  sectionId: z.string().cuid().nullish(),
  nameAr: nameAr(100),
  nameEn: optName(100),
  descAr: text(1000).default(""),
  descEn: text(1000).default(""),
  price: moneyReq(),
  oldPrice: moneyOpt(),
  unit: z.enum(UNITS, { message: m("اختر الوحدة", "Choose a unit") }).default("piece"),
  inStock: z.boolean().default(true),
  featured: z.boolean().optional(),
  ...pinFields,
  locationNote: landmark(),
};
const oldPriceRule = (v: { price?: number | null; oldPrice?: number | null }, ctx: z.RefinementCtx) => {
  if (v.oldPrice != null && v.price != null && v.oldPrice <= v.price)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["oldPrice"], message: m("السعر قبل الخصم لازم يكون أكبر من السعر الحالي", "Old price must be higher than the current price") });
};
export const productCreateSchema = z.object(productFields).superRefine(oldPriceRule).refine(coordsRule, coordsMsg);
export const productUpdateSchema = z.object(productFields).partial().superRefine(oldPriceRule).refine(coordsRule, coordsMsg);
export const productQuickSchema = z.object({ price: moneyReq().optional(), oldPrice: moneyOpt(), inStock: z.boolean().optional(), featured: z.boolean().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), m("لا يوجد تغيير", "Nothing to change")).superRefine(oldPriceRule);
export type ProductInput = z.infer<typeof productCreateSchema>;

/** Event invitations timeline. */
export const postCaptionSchema = z.object({ caption: text(POST_CAPTION_MAX).default("") });
export const commentSchema = z.object({ body: z.string().trim().min(1, m("اكتب تعليقك", "Write your comment")).max(COMMENT_MAX, m("التعليق طويل جداً", "Comment is too long")) });
export const reportSchema = z.object({
  postId: z.string().cuid().optional(),
  commentId: z.string().cuid().optional(),
  reason: text(REPORT_REASON_MAX).default(""),
}).refine((v) => !!v.postId !== !!v.commentId, { message: m("حدد المنشور أو التعليق", "Choose a post or a comment"), path: ["postId"] });
