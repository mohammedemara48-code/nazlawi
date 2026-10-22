import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { profileSchema } from "@/lib/validation";
import { requireSession } from "@/lib/session";
import { updateProfile } from "@/lib/services/account";

export const PATCH = api(async (req) => {
  const s = await requireSession(req);
  await rateLimit(`profile:${s.sub}`, 30, 15 * 60_000);
  const input = profileSchema.parse(await readJson(req));
  return NextResponse.json({ account: await updateProfile(s.sub, input) });
});
