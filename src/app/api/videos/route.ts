import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { ApiError } from "@/lib/errors";
import { uploadVideo, videoLimits } from "@/lib/services/videos";
import { readUpload } from "@/lib/services/media";
void getRequestSession; void readJson;
const target = z.object({ listingId: z.string().cuid().optional(), storeId: z.string().cuid().optional() })
  .refine((v) => !!v.listingId !== !!v.storeId, { message: "listingId|storeId", path: ["listingId"] });

/**
 * multipart/form-data (file + listingId|storeId) or JSON {sourceKey, listingId|storeId} after a direct Blob upload.
 * Replaces the existing video. Returns 201 with processing=QUEUED; a worker transcodes it. PENDING until approved.
 */
export const POST = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`video-upload:${s.sub}`, 5, 60 * 60_000);
  if (Number(req.headers.get("content-length") || 0) > videoLimits().maxBytes + 256 * 1024) throw new ApiError("VIDEO_TOO_LARGE");
  const { upload, fields } = await readUpload(req, s);
  const t = target.parse({ listingId: fields.listingId || undefined, storeId: fields.storeId || undefined });
  const video = await uploadVideo(t, upload, s);
  return NextResponse.json({ video }, { status: 201 });
});
