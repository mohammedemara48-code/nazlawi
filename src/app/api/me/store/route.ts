import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { getMyStore } from "@/lib/services/stores";
void getRequestSession; void readJson; void rateLimit;
/** The caller's store (null when onboarding is still needed). */
export const GET = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  return NextResponse.json({ store: await getMyStore(s.sub) });
});
