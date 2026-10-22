import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { changeEmailSchema } from "@/lib/validation";
import { requireSession } from "@/lib/session";
import { requestEmailChange } from "@/lib/services/account";

/** Sends a confirmation link to the NEW address; the email only changes after it's confirmed. */
export const POST = api(async (req, _ctx, locale) => {
  const s = await requireSession(req);
  await rateLimit(`email-change:${s.sub}`, 3, 15 * 60_000);
  const { password, newEmail } = changeEmailSchema.parse(await readJson(req));
  await requestEmailChange(s.sub, password, newEmail, locale);
  return NextResponse.json({ ok: true }, { status: 202 });
});
