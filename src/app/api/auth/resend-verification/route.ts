import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { sendVerification } from "@/lib/services/tokens";

export const POST = api(async (req, _ctx, locale) => {
  const s = await requireSession(req);
  await rateLimit(`resend:${s.sub}`, 3, 15 * 60_000);
  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user || user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: !!user?.emailVerified });
  if (!(await sendVerification(user, locale))) throw new ApiError("EMAIL_SEND_FAILED");
  return NextResponse.json({ ok: true, sent: true });
});
