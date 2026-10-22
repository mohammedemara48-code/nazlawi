"use client";
import { apiCall } from "./api-client";

export type UploadKind = "image" | "video";
/**
 * Uploads a file to one of our API endpoints.
 * - local driver: multipart POST through the API (dev).
 * - vercel-blob: the browser asks /api/uploads/token for a short-lived, scoped token (authenticated and
 *   ownership-checked), uploads straight to the PRIVATE Blob store under incoming/<userId>/, then posts
 *   {sourceKey, ...fields} as JSON so the large body never passes through a serverless function.
 */
export async function uploadTo<T = Record<string, unknown>>(url: string, lang: string, file: File, opts: { kind: UploadKind; fields?: Record<string, string>; target: Record<string, string>; onProgress?: (pct: number) => void; onFinalizing?: () => void }) {
  if (process.env.NEXT_PUBLIC_STORAGE_DRIVER !== "vercel-blob") {
    const form = new FormData();
    form.append("file", file);
    for (const [k, v] of Object.entries(opts.fields ?? {})) form.append(k, v);
    return apiCall<T>(url, lang, { form });
  }
  const { upload } = await import("@vercel/blob/client");
  const me = await apiCall<{ user: { id: string } }>("/api/auth/me", lang);
  if (!me.ok) return me;
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  // The SDK retries failed PUTs for a long time; cap the transfer so the UI never hangs.
  const ctl = new AbortController();
  const limitMs = 60_000 + Math.ceil(file.size / (64 * 1024)) * 1000; // ~64 KB/s worst case + 1 min
  const timer = setTimeout(() => ctl.abort(), limitMs);
  try {
    const blob = await upload(`incoming/${me.data.user.id}/${opts.kind}.${ext}`, file, {
      access: process.env.NEXT_PUBLIC_BLOB_ACCESS === "public" ? "public" : "private",
      abortSignal: ctl.signal,
      handleUploadUrl: `/api/uploads/token?lang=${lang}`,
      clientPayload: JSON.stringify({ kind: opts.kind, ...opts.target }),
      contentType: file.type,
      onUploadProgress: opts.onProgress ? (e) => opts.onProgress!(Math.min(99, Math.round(e.percentage))) : undefined,
    });
    clearTimeout(timer);
    opts.onFinalizing?.();
    // Finalize: the server checks the blob (head), validates it and records it. Bounded by a timeout.
    return apiCall<T>(url, lang, { body: { sourceKey: blob.pathname, ...(opts.fields ?? {}) }, timeoutMs: 90_000 });
  } catch (e) {
    clearTimeout(timer);
    if (ctl.signal.aborted) return { ok: false as const, data: null, error: lang === "en" ? "The upload took too long. Check your connection and try again." : "الرفع أخد وقت أطول من اللازم. اتأكد من النت وحاول تاني.", details: [] as { field: string; message: string }[] };
    if (typeof console !== "undefined") console.warn("upload failed", e);
    return { ok: false as const, data: null, error: friendlyUploadError(e, lang, opts.kind), details: [] as { field: string; message: string }[] };
  }
}

/** Maps raw Vercel Blob SDK / network errors to a short bilingual-aware message (never raw SDK text). */
export function friendlyUploadError(e: unknown, lang: string, kind: UploadKind) {
  const en = lang === "en";
  const raw = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  const name = e instanceof Error ? e.name : "";
  if (/content type|contenttype|not allowed/.test(raw) && !/token/.test(raw))
    return kind === "video" ? (en ? "Unsupported video type (MP4, WebM or MOV only)" : "نوع الفيديو غير مدعوم (MP4 أو WebM أو MOV فقط)") : (en ? "Unsupported image type (JPG, PNG or WebP only)" : "نوع الصورة غير مدعوم (JPG أو PNG أو WebP فقط)");
  if (/too large|maximum size|file size|413/.test(raw)) return en ? "The file is too large" : "حجم الملف كبير جداً";
  if (/client token|unauthor|forbidden/.test(raw)) return en ? "Couldn't authorize the upload. Sign in again and retry." : "تعذر تجهيز الرفع. سجّل الدخول مرة أخرى وحاول تاني.";
  if (/network|fetch|offline|timeout|abort/.test(raw) || name === "TypeError") return en ? "Network problem while uploading. Check your connection and try again." : "مشكلة في الاتصال أثناء الرفع. اتأكد من النت وحاول تاني.";
  return en ? "Upload failed. Please try again." : "فشل رفع الملف. حاول مرة أخرى.";
}
