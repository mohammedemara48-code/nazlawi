import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { changePasswordSchema } from "@/lib/validation";
import { requireSession, sessionCookie, signSession } from "@/lib/session";
import { changePassword } from "@/lib/services/account";

/** Changes the password, signs out all OTHER sessions, and re-issues this session's cookie. */
export const POST = api(async (req) => {
  const s = await requireSession(req);
  await rateLimit(`password-change:${s.sub}`, 5, 15 * 60_000);
  const { currentPassword, newPassword } = changePasswordSchema.parse(await readJson(req));
  const u = await changePassword(s.sub, currentPassword, newPassword);
  const token = await signSession({ sub: u.id, role: s.role, name: u.name, sv: u.sessionVersion });
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token) } });
});
