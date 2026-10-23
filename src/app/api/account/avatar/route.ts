import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { MAX_IMAGE_BYTES, readUpload } from "@/lib/services/media";
import { removeAvatar, setAvatar } from "@/lib/services/posts";
/** Profile photo: multipart "file" (local) or JSON {sourceKey} after a direct Blob upload. */
export const POST = api(async (req) => {
  const s = await requireSession(req);
  await rateLimit(`avatar:${s.sub}`, 10, 60 * 60_000);
  if (Number(req.headers.get("content-length") || 0) > MAX_IMAGE_BYTES + 64 * 1024) throw new ApiError("FILE_TOO_LARGE");
  const { upload } = await readUpload(req, s);
  return NextResponse.json({ user: await setAvatar(s, upload) }, { status: 201 });
});
export const DELETE = api(async (req) => {
  const s = await requireSession(req);
  await removeAvatar(s);
  return NextResponse.json({ ok: true });
});
