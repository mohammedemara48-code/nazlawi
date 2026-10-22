import { contentTypeFor, storage } from "@/lib/storage";
import { api, ApiError } from "@/lib/errors";
import { getRequestSession } from "@/lib/session";
import { mediaAccess } from "@/lib/services/access";

/**
 * The ONLY way to read stored media (local disk or private Vercel Blob).
 * Files that aren't public (pending/hidden listing or store, unapproved/unprocessed video, suspended owner)
 * are served only to the owner or an admin; others get 404 (existence isn't revealed).
 * Public media gets a short shared-cache TTL so the CDN absorbs traffic while moderation changes
 * propagate within minutes. Supports HTTP Range so videos can seek/play on iOS.
 */
export const GET = api<{ params: Promise<{ key: string[] }> }>(async (req, { params }) => {
  const key = (await params).key.join("/");
  const access = await mediaAccess(key);
  if (!access) throw new ApiError("NOT_FOUND");
  if (!access.public) {
    const s = await getRequestSession(req);
    if (!s || (s.role !== "ADMIN" && s.sub !== access.ownerId)) throw new ApiError("NOT_FOUND");
  }
  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(key),
    "Cache-Control": access.public ? "public, max-age=3600, s-maxage=300, stale-while-revalidate=60" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  let r: Awaited<ReturnType<typeof storage.read>> = null;
  try { r = await storage.read(key, req.headers.get("range")); } catch { /* invalid key */ }
  if (r === "416") {
    const size = (await storage.size(key)) ?? 0;
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  if (!r) throw new ApiError("NOT_FOUND");
  return new Response(r.body as BodyInit, { status: r.status, headers: { ...headers, "Content-Length": String(r.length), ...(r.contentRange ? { "Content-Range": r.contentRange } : {}) } });
});
