import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { deletePost } from "@/lib/services/posts";
type Ctx = { params: Promise<{ id: string }> };
/** Permanent delete: the author or an admin. */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req);
  await rateLimit(`post-del:${s.sub}`, 60, 60_000);
  await deletePost(id, s);
  return NextResponse.json({ ok: true });
});
