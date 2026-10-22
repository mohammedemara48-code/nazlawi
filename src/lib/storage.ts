import fs from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction. Driver chosen by STORAGE_DRIVER:
 *  - "local" (default): files under UPLOAD_DIR (dev/tests, single server).
 *  - "vercel-blob": a PRIVATE Vercel Blob store (BLOB_READ_WRITE_TOKEN). Blobs are never publicly
 *    reachable; every read goes through /api/uploads/[...key], which checks mediaAccess() first.
 * Keys are random (UUID) paths and are only revealed for media the viewer may see.
 */
export type ReadResult = { body: ReadableStream<Uint8Array> | Uint8Array; size: number; status: 200 | 206; contentRange?: string; length: number };
export interface Storage {
  readonly driver: "local" | "vercel-blob";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** Streaming read with optional HTTP Range ("bytes=a-b"). null = not found; "416" = unsatisfiable range. */
  read(key: string, range?: string | null): Promise<ReadResult | null | "416">;
  /** Size in bytes, or null when missing. */
  size(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
export const contentTypeFor = (key: string) => TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

const SAFE_KEY = /^[a-zA-Z0-9/_-]+(\.[a-z0-9]+)?$/;
export function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.startsWith("/")) throw new Error("Invalid storage key");
}

/** Parses a single "bytes=" range against a size. */
export function parseRange(header: string | null | undefined, size: number): { start: number; end: number } | null | "416" {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  let start: number, end: number;
  if (!m[1]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
  if (start > end || start >= size) return "416";
  return { start, end };
}

export class LocalStorage implements Storage {
  readonly driver = "local" as const;
  constructor(private root = path.resolve(process.env.UPLOAD_DIR || "uploads")) {}
  private file(key: string) {
    assertKey(key);
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, data);
  }
  async get(key: string) {
    try { return await fs.readFile(this.file(key)); } catch { return null; }
  }
  async size(key: string) {
    try { return (await fs.stat(this.file(key))).size; } catch { return null; }
  }
  async read(key: string, rangeHeader?: string | null): Promise<ReadResult | null | "416"> {
    const data = await this.get(key);
    if (!data) return null;
    const r = parseRange(rangeHeader, data.length);
    if (r === "416") return "416";
    if (!r) return { body: new Uint8Array(data), size: data.length, status: 200, length: data.length };
    return { body: new Uint8Array(data.subarray(r.start, r.end + 1)), size: data.length, status: 206, contentRange: `bytes ${r.start}-${r.end}/${data.length}`, length: r.end - r.start + 1 };
  }
  async delete(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
  url(key: string) {
    return `/api/uploads/${key}`;
  }
}

/** Private Vercel Blob store. Pathnames = our keys (no random suffix: keys are already UUIDs). */
export class VercelBlobStorage implements Storage {
  readonly driver = "vercel-blob" as const;
  private sdk = import("@vercel/blob");
  constructor(private token = process.env.BLOB_READ_WRITE_TOKEN) {
    if (!token) throw new Error("STORAGE_DRIVER=vercel-blob requires BLOB_READ_WRITE_TOKEN");
  }
  async put(key: string, data: Buffer, contentType: string) {
    assertKey(key);
    const { put } = await this.sdk;
    await put(key, data, { access: "private", contentType, token: this.token, addRandomSuffix: false, allowOverwrite: true });
  }
  async get(key: string) {
    const r = await this.read(key);
    if (!r || r === "416") return null;
    if (r.body instanceof Uint8Array) return Buffer.from(r.body);
    return Buffer.from(await new Response(r.body).arrayBuffer());
  }
  async size(key: string) {
    assertKey(key);
    const { head } = await this.sdk;
    try { return (await head(key, { token: this.token })).size; } catch { return null; }
  }
  async read(key: string, rangeHeader?: string | null): Promise<ReadResult | null | "416"> {
    assertKey(key);
    const size = await this.size(key);
    if (size == null) return null;
    const r = parseRange(rangeHeader, size);
    if (r === "416") return "416";
    const { get } = await this.sdk;
    const res = await get(key, { access: "private", token: this.token, ...(r ? { headers: { range: `bytes=${r.start}-${r.end}` } } : {}) });
    if (!res || !res.stream) return null;
    if (!r) return { body: res.stream, size, status: 200, length: size };
    return { body: res.stream, size, status: 206, contentRange: `bytes ${r.start}-${r.end}/${size}`, length: r.end - r.start + 1 };
  }
  async delete(key: string) {
    assertKey(key);
    const { del } = await this.sdk;
    await del(key, { token: this.token });
  }
  url(key: string) {
    return `/api/uploads/${key}`;
  }
}

export const storageDriver = () => (process.env.STORAGE_DRIVER === "vercel-blob" ? "vercel-blob" : "local");
const g = globalThis as unknown as { storage?: Storage };
export const storage: Storage = (g.storage ??= storageDriver() === "vercel-blob" ? new VercelBlobStorage() : new LocalStorage());
