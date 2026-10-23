import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { reportSchema } from "@/lib/validation";
import { report } from "@/lib/services/posts";
/** Report a post or a comment ({postId} | {commentId}, optional reason). */
export const POST = api(async (req) => {
  const s = await requireSession(req);
  await rateLimit(`report:${s.sub}`, 20, 60 * 60_000);
  const input = reportSchema.parse(await readJson(req));
  await report(input, s);
  return NextResponse.json({ ok: true }, { status: 201 });
});
