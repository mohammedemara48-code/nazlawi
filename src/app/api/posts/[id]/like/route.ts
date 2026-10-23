import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { toggleLike } from "@/lib/services/posts";
type Ctx = { params: Promise<{ id: string }> };
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req);
  await rateLimit(`like:${s.sub}`, 60, 60_000);
  return NextResponse.json(await toggleLike(id, s));
});
