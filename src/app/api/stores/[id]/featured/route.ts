import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { featuredSchema } from "@/lib/validation";
import { setFeatured } from "@/lib/services/stores";
void getRequestSession;
type Ctx = { params: Promise<{ id: string }> };
/** Body: { listingIds: string[] } (max 3, ordered, own APPROVED listings). Replaces the set. */
export const PUT = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`featured:${s.sub}`, 30, 15 * 60_000);
  const { listingIds } = featuredSchema.parse(await readJson(req));
  return NextResponse.json({ featured: await setFeatured(id, listingIds, s) });
});
