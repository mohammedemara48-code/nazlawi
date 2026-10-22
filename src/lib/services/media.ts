import crypto from "node:crypto";
import sharp from "sharp";
import { ApiError } from "../errors";
import { contentTypeFor, storage } from "../storage";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

type Fit = { width: number; height: number; fit: "inside" | "cover" };
/**
 * An uploaded file is either sent through the function (multipart File, local/dev) or uploaded
 * directly from the browser to private Blob storage under incoming/<userId>/ (production).
 */
export type IncomingRef = { sourceKey: string };
export type UploadInput = File | IncomingRef;
export const isIncoming = (u: UploadInput): u is IncomingRef => !(u instanceof File);
const INCOMING = /^incoming\/([a-z0-9]+)\/[A-Za-z0-9_-]+(\.[a-z0-9]+)?$/;

/** The direct-upload key must sit under the caller's own incoming/ folder (or admin). */
export function assertIncomingOwner(key: string, s: { sub: string; role: string }) {
  const m = INCOMING.exec(key);
  if (!m) throw new ApiError("VALIDATION", [{ field: "sourceKey", message: "sourceKey" }]);
  if (m[1] !== s.sub && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
}
export const incomingPrefix = (userId: string) => `incoming/${userId}/`;
const typeFromKey = (key: string) => contentTypeFor(key);

/** Reads either a multipart file or a direct-upload reference into memory (images only, ≤5 MB). */
async function loadImage(u: UploadInput): Promise<{ input: Buffer; type: string; size: number }> {
  if (!isIncoming(u)) return { input: Buffer.from(await u.arrayBuffer()), type: u.type, size: u.size };
  const size = await storage.size(u.sourceKey);
  if (size == null) throw new ApiError("NOT_FOUND");
  if (size > MAX_IMAGE_BYTES) { await storage.delete(u.sourceKey).catch(() => {}); throw new ApiError("FILE_TOO_LARGE"); }
  const input = await storage.get(u.sourceKey);
  if (!input) throw new ApiError("NOT_FOUND");
  return { input, type: typeFromKey(u.sourceKey), size };
}

/** Validates declared type, size and the decoded format; converts to WebP and stores it. */
export async function storeImage(file: UploadInput, prefix: string, box: Fit = { width: 1200, height: 1200, fit: "inside" }) {
  try {
    return await storeImageInner(file, prefix, box);
  } finally {
    if (isIncoming(file)) await storage.delete(file.sourceKey).catch(() => {});
  }
}
async function storeImageInner(file: UploadInput, prefix: string, box: Fit) {
  if (!isIncoming(file) && file.size > MAX_IMAGE_BYTES) throw new ApiError("FILE_TOO_LARGE");
  const { input, type } = await loadImage(file);
  if (!ALLOWED.has(type)) throw new ApiError("FILE_TYPE");
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new ApiError("FILE_TYPE");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new ApiError("FILE_TYPE");
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ ...box, withoutEnlargement: box.fit === "inside" })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const key = `${prefix}/${crypto.randomUUID()}.webp`;
  await storage.put(key, data, "image/webp");
  return { key, width: info.width, height: info.height };
}

/**
 * Reads an upload from the request: multipart "file" (local driver) or JSON {sourceKey, ...fields}
 * after a direct browser→Blob upload. Returns the upload plus the other fields.
 */
export async function readUpload(req: Request, s: { sub: string; role: string }): Promise<{ upload: UploadInput; fields: Record<string, string> }> {
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    let body: Record<string, unknown>;
    try { body = (await req.json()) as Record<string, unknown>; } catch { throw new ApiError("BAD_JSON"); }
    const sourceKey = typeof body.sourceKey === "string" ? body.sourceKey : "";
    assertIncomingOwner(sourceKey, s);
    const fields = Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    return { upload: { sourceKey }, fields };
  }
  const { file, form } = await readFormFile(req);
  const fields: Record<string, string> = {};
  form.forEach((v, k) => { if (typeof v === "string") fields[k] = v; });
  return { upload: file, fields };
}

export async function readFormFile(req: Request, field = "file") {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError("BAD_JSON");
  }
  const file = form.get(field);
  if (!(file instanceof File)) throw new ApiError("VALIDATION", [{ field, message: field }]);
  return { file, form };
}

export const mediaUrl = (key: string | null | undefined) => (key ? storage.url(key) : null);
