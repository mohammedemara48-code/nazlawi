import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { resetSchema } from "@/lib/validation";
import { resetPassword } from "@/lib/services/tokens";
import { clearCookie } from "@/lib/session";

export const POST = api(async (req) => {
  await rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
  const { token, password } = resetSchema.parse(await readJson(req));
  await resetPassword(token, password);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearCookie } });
});
