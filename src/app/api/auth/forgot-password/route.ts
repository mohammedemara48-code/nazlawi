import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { forgotSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/services/tokens";

// Always returns 200 so the endpoint can't be used to discover registered emails.
export const POST = api(async (req, _ctx, locale) => {
  await rateLimit(`forgot-ip:${clientIp(req)}`, 10, 15 * 60_000);
  const { email } = forgotSchema.parse(await readJson(req));
  await rateLimit(`forgot-email:${email}`, 3, 15 * 60_000);
  await requestPasswordReset(email, locale);
  return NextResponse.json({ ok: true });
});
