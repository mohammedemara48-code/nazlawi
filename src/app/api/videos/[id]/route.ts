import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { deleteVideo } from "@/lib/services/videos";
void getRequestSession; void readJson; void rateLimit;
type Ctx = { params: Promise<{ id: string }> };
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await deleteVideo(id, s);
  return new NextResponse(null, { status: 204 });
});
