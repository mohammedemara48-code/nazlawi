import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/lib/services/users";
import { signSession, sessionCookie } from "@/lib/session";

export const POST = api(async (req) => {
  const input = loginSchema.parse(await readJson(req));
  await rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  await rateLimit(`login-email:${input.email}`, 5, 60_000);
  const user = await authenticate(input.email, input.password);
  const token = await signSession({ sub: user.id, role: user.role, name: user.name, sv: user.sv });
  const { sv: _sv, ...publicUser } = user;
  void _sv;
  return NextResponse.json({ user: publicUser }, { headers: { "Set-Cookie": sessionCookie(token) } });
});
