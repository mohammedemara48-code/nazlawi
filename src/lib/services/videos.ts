import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError, type ErrorCode } from "../errors";
import { storage } from "../storage";
import type { Session } from "../session";
import { audit } from "./audit";
import { isIncoming, type UploadInput } from "./media";

const run = promisify(execFile);
// Binaries: system ffmpeg by default; override (e.g. ffmpeg-static on Vercel) with FFMPEG_PATH / FFPROBE_PATH.
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
// ffprobe format_name values we accept (mp4/mov family and webm/matroska).
const ALLOWED_FORMATS = /^(mov,mp4,m4a,3gp,3g2,mj2|matroska,webm)$/;
export const videoLimits = () => ({
  maxBytes: Number(process.env.VIDEO_MAX_MB ?? 50) * 1024 * 1024,
  maxSeconds: Number(process.env.VIDEO_MAX_SECONDS ?? 60),
});
export const videoKeys = (v: { key: string | null; posterKey: string | null; sourceKey?: string | null }) =>
  [v.key, v.posterKey, v.sourceKey].filter((k): k is string => !!k);

type Probe = { format?: { format_name?: string; duration?: string }; streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[] };
export async function probe(file: string): Promise<Probe | null> {
  try {
    const { stdout } = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { timeout: 20_000 });
    return JSON.parse(stdout) as Probe;
  } catch {
    return null;
  }
}

/** Real-content check with ffprobe: allowed container, has a video stream, duration within limit. */
export async function validateVideoFile(file: string) {
  const { maxSeconds } = videoLimits();
  const info = await probe(file);
  const v = info?.streams?.find((st) => st.codec_type === "video");
  if (!info?.format?.format_name || !ALLOWED_FORMATS.test(info.format.format_name) || !v) throw new ApiError("VIDEO_INVALID");
  const duration = Number(info.format.duration ?? v.duration ?? NaN);
  if (!Number.isFinite(duration) || duration <= 0) throw new ApiError("VIDEO_INVALID");
  if (duration > maxSeconds + 0.5) throw new ApiError("VIDEO_TOO_LONG");
  return duration;
}

/** Validates then transcodes a local file to H.264 MP4 (≤720p, faststart) + WebP poster. CPU heavy: worker only. */
export async function transcodeVideoFile(input: string) {
  const { maxSeconds } = videoLimits();
  const duration = await validateVideoFile(input);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nz-video-"));
  try {
    const out = path.join(dir, "out.mp4");
    try {
      await run(FFMPEG, [
        "-v", "error", "-y", "-i", input, "-t", String(maxSeconds),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", "scale='min(720,iw)':-2:flags=bicubic,format=yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-profile:v", "main",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out,
      ], { timeout: 280_000 });
    } catch {
      throw new ApiError("VIDEO_INVALID");
    }
    const final = await probe(out);
    const fv = final?.streams?.find((st) => st.codec_type === "video");
    const outDuration = Number(final?.format?.duration ?? duration);
    const posterPng = path.join(dir, "poster.png");
    await run(FFMPEG, ["-v", "error", "-y", "-ss", String(Math.min(1, outDuration / 2)), "-i", out, "-frames:v", "1", posterPng], { timeout: 30_000 });
    const poster = await sharp(posterPng).webp({ quality: 75 }).toBuffer();
    const mp4 = await fs.readFile(out);
    return { mp4, poster, durationSec: Math.round(outDuration * 10) / 10, width: fv?.width ?? 0, height: fv?.height ?? 0 };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Convenience for scripts/seed: transcode an in-memory File. */
export async function processVideo(file: File) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nz-in-"));
  try {
    const input = path.join(dir, "in");
    await fs.writeFile(input, Buffer.from(await file.arrayBuffer()));
    return await transcodeVideoFile(input);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function authorizeTarget(target: { listingId?: string; storeId?: string }, s: Session) {
  if (!!target.listingId === !!target.storeId) throw new ApiError("VALIDATION", [{ field: "target", message: "listingId|storeId" }]);
  const owner = target.listingId
    ? (await prisma.listing.findUnique({ where: { id: target.listingId }, select: { ownerId: true } }))?.ownerId
    : (await prisma.store.findUnique({ where: { id: target.storeId! }, select: { ownerId: true } }))?.ownerId;
  if (owner === undefined) throw new ApiError("NOT_FOUND");
  if (s.role !== "ADMIN" && owner !== s.sub) throw new ApiError("FORBIDDEN");
  return owner ?? s.sub;
}
export { authorizeTarget as authorizeVideoTarget };

/**
 * Upload/replace the single promo video of a listing or a store.
 * Stores the original (multipart through the function in dev, or a direct Blob upload in production),
 * creates the Video row (processing=QUEUED) and a VideoJob. Transcoding happens in the worker.
 * Multipart uploads are ffprobe-checked right away (cheap) so obviously bad files fail fast.
 */
export async function uploadVideo(target: { listingId?: string; storeId?: string }, upload: UploadInput, s: Session, opts: { isExample?: boolean } = {}) {
  const owner = await authorizeTarget(target, s);
  const { maxBytes } = videoLimits();
  let sourceKey: string, sizeBytes: number;
  if (isIncoming(upload)) {
    const size = await storage.size(upload.sourceKey);
    if (size == null) throw new ApiError("NOT_FOUND");
    if (size > maxBytes) { await storage.delete(upload.sourceKey).catch(() => {}); throw new ApiError("VIDEO_TOO_LARGE"); }
    sourceKey = upload.sourceKey;
    sizeBytes = size;
  } else {
    if (upload.size > maxBytes) throw new ApiError("VIDEO_TOO_LARGE");
    if (!ALLOWED_TYPES.has(upload.type)) throw new ApiError("VIDEO_INVALID");
    const buf = Buffer.from(await upload.arrayBuffer());
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nz-up-"));
    try {
      await fs.writeFile(path.join(dir, "in"), buf);
      await validateVideoFile(path.join(dir, "in"));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
    sourceKey = `incoming/${s.sub}/${crypto.randomUUID()}.${EXT[upload.type]}`;
    await storage.put(sourceKey, buf, upload.type);
    sizeBytes = buf.length;
  }
  const old = await prisma.video.findUnique({ where: target.listingId ? { listingId: target.listingId } : { storeId: target.storeId! } });
  if (old) {
    await prisma.video.delete({ where: { id: old.id } });
    await Promise.all(videoKeys(old).map((k) => storage.delete(k))).catch(() => {});
  }
  return prisma.video.create({
    data: {
      ...target, ownerId: owner, sourceKey, sizeBytes, processing: "QUEUED",
      status: s.role === "ADMIN" ? "APPROVED" : "PENDING", isExample: !!opts.isExample,
      jobs: { create: {} },
    },
  });
}

// ---------- background processing ----------
const LOCK_TIMEOUT_MS = 15 * 60_000;
const backoff = (attempt: number) => Math.min(30 * 60_000, 30_000 * 2 ** attempt);
/** Errors that retrying can't fix. */
const PERMANENT: ErrorCode[] = ["VIDEO_INVALID", "VIDEO_TOO_LONG", "VIDEO_TOO_LARGE"];

/** Atomically claims the next runnable job (Postgres row lock, safe with several workers). */
export async function claimVideoJob(now = new Date()) {
  // Prisma stores DateTime as UTC "timestamp without time zone"; convert explicitly so the comparison
  // doesn't depend on the DB session TimeZone.
  const ts = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "VideoJob" SET status = 'PROCESSING', "lockedAt" = ${ts(now)}, attempts = attempts + 1, "updatedAt" = ${ts(now)}
    WHERE id = (
      SELECT id FROM "VideoJob"
      WHERE (status = 'PENDING' AND "runAfter" <= ${ts(now)})
         OR (status = 'PROCESSING' AND "lockedAt" < ${ts(new Date(now.getTime() - LOCK_TIMEOUT_MS))})
      ORDER BY "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id`);
  return rows[0] ? prisma.videoJob.findUnique({ where: { id: rows[0].id }, include: { video: true } }) : null;
}

/** Processes one claimed job: download original → ffprobe/ffmpeg → store mp4 + poster → mark READY. */
export async function runVideoJob(job: NonNullable<Awaited<ReturnType<typeof claimVideoJob>>>) {
  const v = job.video;
  if (!v.sourceKey) {
    await prisma.videoJob.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null } });
    return "DONE" as const;
  }
  await prisma.video.update({ where: { id: v.id }, data: { processing: "PROCESSING" } });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nz-job-"));
  try {
    const src = await storage.get(v.sourceKey);
    if (!src) throw new ApiError("VIDEO_INVALID");
    const input = path.join(dir, "in");
    await fs.writeFile(input, src);
    const out = await transcodeVideoFile(input);
    const id = crypto.randomUUID();
    const key = `videos/${id}.mp4`, posterKey = `videos/${id}.webp`;
    await storage.put(key, out.mp4, "video/mp4");
    await storage.put(posterKey, out.poster, "image/webp");
    await prisma.$transaction([
      prisma.video.update({ where: { id: v.id }, data: { key, posterKey, sourceKey: null, durationSec: out.durationSec, width: out.width, height: out.height, sizeBytes: out.mp4.length, processing: "READY", error: null } }),
      prisma.videoJob.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null, lastError: null } }),
    ]);
    await storage.delete(v.sourceKey).catch(() => {});
    return "DONE" as const;
  } catch (e) {
    const code = e instanceof ApiError ? e.code : "INTERNAL";
    const permanent = PERMANENT.includes(code as ErrorCode) || job.attempts >= job.maxAttempts;
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    if (permanent) {
      await prisma.$transaction([
        prisma.videoJob.update({ where: { id: job.id }, data: { status: "FAILED", lockedAt: null, lastError: `${code}: ${msg}` } }),
        prisma.video.update({ where: { id: v.id }, data: { processing: "FAILED", error: code } }),
      ]);
      await storage.delete(v.sourceKey).catch(() => {});
      return "FAILED" as const;
    }
    await prisma.$transaction([
      prisma.videoJob.update({ where: { id: job.id }, data: { status: "PENDING", lockedAt: null, lastError: `${code}: ${msg}`, runAfter: new Date(Date.now() + backoff(job.attempts)) } }),
      prisma.video.update({ where: { id: v.id }, data: { processing: "QUEUED" } }),
    ]);
    return "RETRY" as const;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Drains runnable jobs until none are left, `max` is reached or the time budget is spent. */
export async function runPendingVideoJobs(opts: { max?: number; budgetMs?: number } = {}) {
  const started = Date.now();
  const results: { id: string; result: string }[] = [];
  while (results.length < (opts.max ?? 10) && Date.now() - started < (opts.budgetMs ?? 240_000)) {
    const job = await claimVideoJob();
    if (!job) break;
    results.push({ id: job.id, result: await runVideoJob(job) });
  }
  return results;
}

export async function deleteVideo(id: string, s: Session) {
  const v = await prisma.video.findUnique({ where: { id } });
  if (!v) throw new ApiError("NOT_FOUND");
  if (s.role !== "ADMIN" && v.ownerId !== s.sub) throw new ApiError("FORBIDDEN");
  await prisma.video.delete({ where: { id } });
  await Promise.all(videoKeys(v).map((k) => storage.delete(k))).catch(() => {});
}

export async function setVideoStatus(id: string, status: "PENDING" | "APPROVED" | "REJECTED", admin: Session) {
  const v = await prisma.video.findUnique({ where: { id } });
  if (!v) throw new ApiError("NOT_FOUND");
  const updated = await prisma.video.update({ where: { id }, data: { status } });
  if (v.status !== status) await audit(admin, "VIDEO_STATUS_CHANGED", "VIDEO", id, { from: v.status, to: status, target: v.listingId ? `listing:${v.listingId}` : `store:${v.storeId}` });
  return updated;
}

export async function adminListVideos(status: string | undefined, page: number, pageSize: number) {
  const where = status ? { status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.video.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { listing: { select: { id: true, nameAr: true, nameEn: true } }, store: { select: { id: true, slug: true, nameAr: true, nameEn: true } } } }),
    prisma.video.count({ where }),
  ]);
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
