import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifySchema } from "@/lib/validation";
import { confirmEmailChange } from "@/lib/services/tokens";

export const POST = api(async (req) => {
  await rateLimit(`confirm-email:${clientIp(req)}`, 20, 15 * 60_000);
  const { token } = verifySchema.parse(await readJson(req));
  await confirmEmailChange(token);
  return NextResponse.json({ ok: true });
});
