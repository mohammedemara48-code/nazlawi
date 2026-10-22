import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifySchema } from "@/lib/validation";
import { verifyEmail } from "@/lib/services/tokens";

export const POST = api(async (req) => {
  await rateLimit(`verify:${clientIp(req)}`, 20, 15 * 60_000);
  const { token } = verifySchema.parse(await readJson(req));
  await verifyEmail(token);
  return NextResponse.json({ ok: true });
});
