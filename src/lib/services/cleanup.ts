import { prisma } from "../db";
import { storageDriver } from "../storage";

/** Removes abandoned direct uploads from Blob storage (only relevant for the vercel-blob driver). */
export async function cleanupIncoming(olderThanMs = 24 * 3600_000) {
  if (storageDriver() !== "vercel-blob") return 0;
  const { list, del } = await import("@vercel/blob");
  const cutoff = Date.now() - olderThanMs;
  let cursor: string | undefined, deleted = 0;
  do {
    const page = await list({ prefix: "incoming/", cursor, limit: 500 });
    const old = page.blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.pathname);
    const inUse = new Set((await prisma.video.findMany({ where: { sourceKey: { in: old } }, select: { sourceKey: true } })).map((v) => v.sourceKey));
    const doomed = old.filter((p) => !inUse.has(p));
    if (doomed.length) { await del(doomed); deleted += doomed.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}
