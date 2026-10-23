import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { api, ApiError, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { prisma } from "@/lib/db";
import { storageDriver } from "@/lib/storage";
import { MAX_IMAGE_BYTES } from "@/lib/services/media";
import { canPost } from "@/lib/services/posts";
import { authorizeVideoTarget, videoLimits } from "@/lib/services/videos";

const payloadSchema = z.object({
  kind: z.enum(["image", "video"]),
  listingId: z.string().cuid().optional(),
  storeId: z.string().cuid().optional(),
  // Resident-owned images (any signed-in user): an invitations post or the profile photo.
  purpose: z.enum(["post", "avatar"]).optional(),
}).refine((v) => [v.listingId, v.storeId, v.purpose].filter(Boolean).length === 1, { message: "listingId|storeId|purpose" });

/**
 * Issues a short-lived (10 min) client upload token for a direct browser → private Vercel Blob upload.
 * The caller must be signed in, a PROVIDER/ADMIN, and own the target listing/store. The token only allows
 * the pathname under incoming/<userId>/ (+ random suffix), the right content types and the size limit.
 * The uploaded original is not servable (mediaAccess has no record of incoming/ keys) until our API
 * processes it (images → WebP; videos → VideoJob).
 */
export const POST = api(async (req) => {
  if (storageDriver() !== "vercel-blob") throw new ApiError("NOT_FOUND");
  const body = (await readJson(req)) as HandleUploadBody;
  // Completion callbacks come from Vercel (signed); handleUpload verifies them. We finalize via our own API instead.
  if (body?.type === "blob.upload-completed") {
    return NextResponse.json(await handleUpload({ body, request: req, onBeforeGenerateToken: async () => { throw new ApiError("FORBIDDEN"); } }));
  }
  const s = await requireSession(req);
  await rateLimit(`upload-token:${s.sub}`, 200, 60 * 60_000);
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      let parsed: unknown;
      try { parsed = JSON.parse(clientPayload ?? ""); } catch { throw new ApiError("VALIDATION"); }
      const p = payloadSchema.parse(parsed);
      if (p.purpose) {
        if (p.kind !== "image") throw new ApiError("FORBIDDEN");
        if (p.purpose === "post" && !canPost(s.role)) throw new ApiError("POST_RESIDENTS_ONLY");
      } else if (s.role !== "PROVIDER" && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
      if (!new RegExp(`^incoming/${s.sub}/(image|video)\\.[a-z0-9]{1,5}$`).test(pathname) || !pathname.includes(`/${p.kind}.`)) throw new ApiError("FORBIDDEN");
      if (p.kind === "video") {
        await authorizeVideoTarget(p, s);
      } else if (!p.purpose) {
        const owner = p.listingId
          ? (await prisma.listing.findUnique({ where: { id: p.listingId }, select: { ownerId: true } }))?.ownerId
          : (await prisma.store.findUnique({ where: { id: p.storeId! }, select: { ownerId: true } }))?.ownerId;
        if (owner === undefined) throw new ApiError("NOT_FOUND");
        if (s.role !== "ADMIN" && owner !== s.sub) throw new ApiError("FORBIDDEN");
      }
      return {
        allowedContentTypes: p.kind === "video" ? ["video/mp4", "video/webm", "video/quicktime"] : ["image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: p.kind === "video" ? videoLimits().maxBytes : MAX_IMAGE_BYTES,
        addRandomSuffix: true,
        validUntil: Date.now() + 10 * 60_000,
        tokenPayload: JSON.stringify({ userId: s.sub, ...p }),
      };
    },
  });
  return NextResponse.json(result);
});
