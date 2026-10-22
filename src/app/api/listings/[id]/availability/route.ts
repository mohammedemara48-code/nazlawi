import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { availabilitySchema } from "@/lib/validation";
import { setAvailability } from "@/lib/services/listings";
void getRequestSession; void rateLimit;
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  const { available } = availabilitySchema.parse(await readJson(req));
  return NextResponse.json({ listing: await setAvailability(id, available, s) });
});
