import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import { promotionRequestSchema } from "@/lib/validation";
import { activePromotions, requestPromotion } from "@/lib/services/promotions";
void getRequestSession;
/** Public: active promotions for the strip (?category=). */
export const GET = api(async (req) => {
  const category = z.enum(CATEGORIES).optional().parse(new URL(req.url).searchParams.get("category") ?? undefined);
  return NextResponse.json({ items: await activePromotions({ category }) });
});
/** Provider requests a promotion (PENDING until an admin approves). */
export const POST = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`promo:${s.sub}`, 10, 60 * 60_000);
  const input = promotionRequestSchema.parse(await readJson(req));
  return NextResponse.json({ promotion: await requestPromotion(input, s) }, { status: 201 });
});
