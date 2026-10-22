import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireCron } from "@/lib/cron";
import { expirePromotions } from "@/lib/services/promotions";

export const dynamic = "force-dynamic";
/** Vercel Cron: marks APPROVED promotions whose endsAt passed as EXPIRED (reads also filter by date). */
export const GET = api(async (req) => {
  requireCron(req);
  return NextResponse.json({ expired: await expirePromotions() });
});
