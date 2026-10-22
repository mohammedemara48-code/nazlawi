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
export async function uploadTo<T = Record<string, unknown>>(url: string, lang: string, file: File, opts: { kind: UploadKind; fields?: Record<string, string>; target: Record<string, string>; onProgress?: (pct: number) => void }) {
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
  try {
    const blob = await upload(`incoming/${me.data.user.id}/${opts.kind}.${ext}`, file, {
      access: "private",
      handleUploadUrl: `/api/uploads/token?lang=${lang}`,
      clientPayload: JSON.stringify({ kind: opts.kind, ...opts.target }),
      contentType: file.type,
      onUploadProgress: opts.onProgress ? (e) => opts.onProgress!(Math.round(e.percentage)) : undefined,
    });
    return apiCall<T>(url, lang, { body: { sourceKey: blob.pathname, ...(opts.fields ?? {}) } });
  } catch (e) {
    return { ok: false as const, data: null, error: e instanceof Error ? e.message : "Upload failed", details: [] as { field: string; message: string }[] };
  }
}
