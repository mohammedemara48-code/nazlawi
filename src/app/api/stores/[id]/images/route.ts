import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { ApiError } from "@/lib/errors";
import { setStoreImage } from "@/lib/services/stores";
import { MAX_IMAGE_BYTES, readUpload } from "@/lib/services/media";
void getRequestSession; void readJson;
type Ctx = { params: Promise<{ id: string }> };
/** multipart/form-data "file"; ?kind=logo|cover */
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`upload:${s.sub}`, 30, 60 * 60_000);
  const kind = z.enum(["logo", "cover"]).parse(new URL(req.url).searchParams.get("kind"));
  if (Number(req.headers.get("content-length") || 0) > MAX_IMAGE_BYTES + 64 * 1024) throw new ApiError("FILE_TOO_LARGE");
  const { upload: file } = await readUpload(req, s);
  return NextResponse.json({ store: await setStoreImage(id, kind, file, s) }, { status: 201 });
});
