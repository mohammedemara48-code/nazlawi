import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { requireSession } from "@/lib/session";
import { adminResendVerification } from "@/lib/services/admin-users";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }, locale) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-resend:${id}`, 3, 15 * 60_000);
  return NextResponse.json(await adminResendVerification(s, id, locale));
});
