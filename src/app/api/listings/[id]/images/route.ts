import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/errors";
import { addListingImage } from "@/lib/services/listings";
import { MAX_IMAGE_BYTES, readUpload } from "@/lib/services/media";
void getRequestSession; void readJson;
type Ctx = { params: Promise<{ id: string }> };
/** multipart/form-data field "file", or JSON {sourceKey} after a direct Blob upload. */
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`upload:${s.sub}`, 30, 60 * 60_000);
  if (Number(req.headers.get("content-length") || 0) > MAX_IMAGE_BYTES + 64 * 1024) throw new ApiError("FILE_TOO_LARGE");
  const { upload: file } = await readUpload(req, s);
  const image = await addListingImage(id, file, s);
  return NextResponse.json({ image: { ...image, url: `/api/uploads/${image.key}` } }, { status: 201 });
});
