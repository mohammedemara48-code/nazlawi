import { NextResponse } from "next/server";
import { api, ApiError, readJson } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { deleteAccountSchema } from "@/lib/validation";
import { clearCookie, requireSession } from "@/lib/session";
import { deleteAccount, getAccount } from "@/lib/services/account";

export const GET = api(async (req) => {
  const s = await requireSession(req);
  const account = await getAccount(s.sub);
  if (!account) throw new ApiError("UNAUTHORIZED");
  return NextResponse.json({ account });
});

/** Body: { password }. Deletes the account with its listings and images. */
export const DELETE = api(async (req) => {
  const s = await requireSession(req);
  await rateLimit(`account-delete:${s.sub}`, 5, 15 * 60_000);
  const { password } = deleteAccountSchema.parse(await readJson(req));
  await deleteAccount(s.sub, password);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearCookie } });
});
