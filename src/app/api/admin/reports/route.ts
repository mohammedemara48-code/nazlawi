import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { dismissReports, listReports } from "@/lib/services/posts";
export const GET = api(async (req) => {
  await requireSession(req, ["ADMIN"]);
  return NextResponse.json({ items: await listReports() });
});
const target = z.object({ postId: z.string().cuid().optional(), commentId: z.string().cuid().optional() }).refine((v) => !!v.postId !== !!v.commentId);
/** Dismiss: keep the content, clear its reports. (Deleting uses DELETE /api/posts/:id or /api/comments/:id.) */
export const DELETE = api(async (req) => {
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-mod:${s.sub}`, 120, 60_000);
  await dismissReports(target.parse(await readJson(req)));
  return NextResponse.json({ ok: true });
});
