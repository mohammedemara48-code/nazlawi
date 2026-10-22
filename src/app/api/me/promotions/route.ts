import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { myPromotions } from "@/lib/services/promotions";
void getRequestSession; void readJson; void rateLimit;
export const GET = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  return NextResponse.json({ items: await myPromotions(s.sub) });
});
