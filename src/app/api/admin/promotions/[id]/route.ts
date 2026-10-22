import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { promotionAdminSchema } from "@/lib/validation";
import { adminUpdatePromotion } from "@/lib/services/promotions";
void getRequestSession;
type Ctx = { params: Promise<{ id: string }> };
/** Approve/reject/expire, set priority, reschedule. */
export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-mod:${s.sub}`, 120, 60_000);
  const change = promotionAdminSchema.parse(await readJson(req));
  return NextResponse.json({ promotion: await adminUpdatePromotion(id, change, s) });
});
