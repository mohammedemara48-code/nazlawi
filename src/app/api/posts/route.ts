import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/errors";
import { getRequestSession, requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { POSTS_PER_DAY } from "@/lib/constants";
import { postCaptionSchema } from "@/lib/validation";
import { MAX_IMAGE_BYTES, readUpload } from "@/lib/services/media";
import { canPost, createPost, listPosts } from "@/lib/services/posts";

/** Timeline feed (JSON). ?page=n */
export const GET = api(async (req) => {
  const s = await getRequestSession(req);
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);
  return NextResponse.json(await listPosts({ page, viewerId: s?.sub }));
});

/** New invitation post: multipart "file" + "caption" (local) or JSON {sourceKey, caption} after a direct Blob upload. */
export const POST = api(async (req) => {
  const s = await requireSession(req);
  if (!canPost(s.role)) throw new ApiError("POST_RESIDENTS_ONLY");
  await rateLimit(`post-burst:${s.sub}`, 2, 60_000);
  await rateLimit(`post-day:${s.sub}`, POSTS_PER_DAY, 24 * 60 * 60_000);
  if (Number(req.headers.get("content-length") || 0) > MAX_IMAGE_BYTES + 64 * 1024) throw new ApiError("FILE_TOO_LARGE");
  const { upload, fields } = await readUpload(req, s);
  const { caption } = postCaptionSchema.parse({ caption: fields.caption ?? "" });
  return NextResponse.json({ post: await createPost(s, upload, caption) }, { status: 201 });
});
