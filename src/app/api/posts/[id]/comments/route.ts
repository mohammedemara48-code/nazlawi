import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { commentSchema } from "@/lib/validation";
import { addComment } from "@/lib/services/posts";
type Ctx = { params: Promise<{ id: string }> };
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req);
  await rateLimit(`comment:${s.sub}`, 10, 60_000);
  await rateLimit(`comment-day:${s.sub}`, 200, 24 * 60 * 60_000);
  const { body } = commentSchema.parse(await readJson(req));
  return NextResponse.json({ comment: await addComment(id, body, s) }, { status: 201 });
});
