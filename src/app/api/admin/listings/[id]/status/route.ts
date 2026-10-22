import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { moderationSchema } from "@/lib/validation";
import { setListingStatus } from "@/lib/services/listings";
void getRequestSession;
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-mod:${s.sub}`, 120, 60_000);
  const { status } = moderationSchema.parse(await readJson(req));
  return NextResponse.json({ listing: await setListingStatus(id, status, s) });
});
