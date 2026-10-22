import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { cancelPromotion } from "@/lib/services/promotions";
void getRequestSession; void readJson; void rateLimit;
type Ctx = { params: Promise<{ id: string }> };
/** Provider cancels their own PENDING request. */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await cancelPromotion(id, s);
  return new NextResponse(null, { status: 204 });
});
