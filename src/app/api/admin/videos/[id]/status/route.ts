import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { videoStatusSchema } from "@/lib/validation";
import { setVideoStatus } from "@/lib/services/videos";
void getRequestSession;
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-mod:${s.sub}`, 120, 60_000);
  const { status } = videoStatusSchema.parse(await readJson(req));
  return NextResponse.json({ video: await setVideoStatus(id, status, s) });
});
