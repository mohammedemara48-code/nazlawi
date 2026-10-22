import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { signupSchema } from "@/lib/validation";
import { createUser } from "@/lib/services/users";
import { sendVerification } from "@/lib/services/tokens";
import { signSession, sessionCookie } from "@/lib/session";

export const POST = api(async (req, _ctx, locale) => {
  await rateLimit(`signup:${clientIp(req)}`, 5, 60_000);
  const input = signupSchema.parse(await readJson(req));
  const user = await createUser(input);
  await sendVerification(user, input.lang ?? locale);
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  return NextResponse.json({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
});
