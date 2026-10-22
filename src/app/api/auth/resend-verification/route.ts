import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { sendVerification } from "@/lib/services/tokens";

export const POST = api(async (req, _ctx, locale) => {
  const s = await requireSession(req);
  await rateLimit(`resend:${s.sub}`, 3, 15 * 60_000);
  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (user && !user.emailVerified) await sendVerification(user, locale);
  return NextResponse.json({ ok: true });
});
