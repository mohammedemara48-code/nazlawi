import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { deleteComment } from "@/lib/services/posts";
type Ctx = { params: Promise<{ id: string }> };
/** Permanent delete: the comment's author or an admin. */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req);
  await rateLimit(`comment-del:${s.sub}`, 60, 60_000);
  await deleteComment(id, s);
  return NextResponse.json({ ok: true });
});
