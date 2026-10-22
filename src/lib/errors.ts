import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Locale } from "./constants";

const MESSAGES = {
  VALIDATION: { ar: "البيانات المدخلة غير صحيحة", en: "Invalid input" },
  UNAUTHORIZED: { ar: "يجب تسجيل الدخول أولاً", en: "You must sign in first" },
  FORBIDDEN: { ar: "ليس لديك صلاحية لهذا الإجراء", en: "You are not allowed to do this" },
  NOT_FOUND: { ar: "العنصر غير موجود", en: "Not found" },
  EMAIL_TAKEN: { ar: "البريد الإلكتروني مسجل بالفعل", en: "Email is already registered" },
  INVALID_CREDENTIALS: { ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة", en: "Invalid email or password" },
  RATE_LIMITED: { ar: "محاولات كثيرة، حاول مرة أخرى بعد قليل", en: "Too many attempts, please try again later" },
  BAD_JSON: { ar: "صيغة الطلب غير صحيحة", en: "Malformed request body" },
  INTERNAL: { ar: "حدث خطأ غير متوقع", en: "Unexpected server error" },
  TOKEN_INVALID: { ar: "الرابط غير صالح أو انتهت صلاحيته", en: "This link is invalid or has expired" },
  EMAIL_NOT_VERIFIED: { ar: "يجب تأكيد بريدك الإلكتروني أولاً", en: "Please verify your email first" },
  FILE_TOO_LARGE: { ar: "حجم الصورة كبير جداً (الحد الأقصى 5 ميجا)", en: "Image is too large (max 5 MB)" },
  FILE_TYPE: { ar: "نوع الملف غير مدعوم (JPG أو PNG أو WebP فقط)", en: "Unsupported file type (JPG, PNG or WebP only)" },
  TOO_MANY_IMAGES: { ar: "وصلت للحد الأقصى لعدد الصور", en: "Maximum number of images reached" },
  ACCOUNT_SUSPENDED: { ar: "تم إيقاف هذا الحساب. تواصل مع الإدارة.", en: "This account is suspended. Please contact support." },
  WRONG_PASSWORD: { ar: "كلمة المرور الحالية غير صحيحة", en: "Current password is incorrect" },
  CANNOT_MODIFY_SELF: { ar: "لا يمكنك تخفيض صلاحياتك أو إيقاف حسابك بنفسك", en: "You can't demote or suspend your own account" },
  LAST_ADMIN: { ar: "يجب أن يبقى مدير واحد نشط على الأقل", en: "At least one active admin must remain" },
  SAME_EMAIL: { ar: "هذا هو بريدك الحالي بالفعل", en: "That is already your email" },
  STORE_REQUIRED: { ar: "لازم تنشئ متجرك الأول", en: "Create your store first" },
  STORE_EXISTS: { ar: "عندك متجر بالفعل", en: "You already have a store" },
  FEATURED_LIMIT: { ar: "تقدر تختار 3 إعلانات مميزة كحد أقصى", en: "You can feature at most 3 listings" },
  NOT_APPROVED: { ar: "لازم الإعلان يكون منشور الأول", en: "The listing must be approved first" },
  VIDEO_INVALID: { ar: "ملف الفيديو غير صالح (MP4 أو WebM أو MOV فقط)", en: "Invalid video file (MP4, WebM or MOV only)" },
  VIDEO_TOO_LARGE: { ar: "حجم الفيديو كبير جداً", en: "Video file is too large" },
  VIDEO_TOO_LONG: { ar: "مدة الفيديو أطول من المسموح", en: "Video is longer than allowed" },
  INVALID_DATES: { ar: "تواريخ العرض غير صحيحة", en: "Invalid promotion dates" },
  PROMOTION_LIMIT: { ar: "عندك طلبات ترويج كتير قيد المراجعة", en: "Too many pending promotion requests" },
  PROMOTION_ENDED: { ar: "انتهت مدة هذا العرض", en: "This promotion has already ended" },
} as const;
export type ErrorCode = keyof typeof MESSAGES;
const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 422, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401, RATE_LIMITED: 429, BAD_JSON: 400, INTERNAL: 500,
  TOKEN_INVALID: 400, EMAIL_NOT_VERIFIED: 403, ACCOUNT_SUSPENDED: 403, WRONG_PASSWORD: 403,
  CANNOT_MODIFY_SELF: 409, LAST_ADMIN: 409, SAME_EMAIL: 409,
  STORE_REQUIRED: 409, STORE_EXISTS: 409, FEATURED_LIMIT: 422, NOT_APPROVED: 409,
  VIDEO_INVALID: 415, VIDEO_TOO_LARGE: 413, VIDEO_TOO_LONG: 422, INVALID_DATES: 422, PROMOTION_LIMIT: 429, PROMOTION_ENDED: 409, FILE_TOO_LARGE: 413, FILE_TYPE: 415, TOO_MANY_IMAGES: 409,
};

export class ApiError extends Error {
  constructor(public code: ErrorCode, public details?: unknown, public headers?: Record<string, string>) {
    super(code);
  }
}

export function localeFromRequest(req: Request): Locale {
  const url = new URL(req.url);
  const q = url.searchParams.get("lang");
  if (q === "en" || q === "ar") return q;
  const h = req.headers.get("accept-language") ?? "";
  return h.toLowerCase().startsWith("en") ? "en" : "ar";
}

/** Consistent error shape: { error: { code, message, details? } } */
export function errorResponse(err: unknown, locale: Locale) {
  if (err instanceof ZodError) err = new ApiError("VALIDATION", zodDetails(err, locale));
  if (!(err instanceof ApiError)) {
    console.error(err);
    err = new ApiError("INTERNAL");
  }
  const e = err as ApiError;
  return NextResponse.json(
    { error: { code: e.code, message: MESSAGES[e.code][locale], ...(e.details ? { details: e.details } : {}) } },
    { status: STATUS[e.code], headers: e.headers },
  );
}

function zodDetails(err: ZodError, locale: Locale) {
  return err.issues.map((i) => {
    const raw = i.message;
    // messages are encoded "ar|en" in validation.ts
    const [ar, en] = raw.includes("|") ? raw.split("|") : [raw, raw];
    return { field: i.path.join("."), message: locale === "en" ? en : ar };
  });
}

type Handler<C> = (req: Request, ctx: C, locale: Locale) => Promise<Response>;
export function api<C = unknown>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    const locale = localeFromRequest(req);
    try {
      return await fn(req, ctx, locale);
    } catch (err) {
      return errorResponse(err, locale);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError("BAD_JSON");
  }
}
