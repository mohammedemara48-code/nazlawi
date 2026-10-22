import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { listQuerySchema } from "@/lib/validation";
import { listListings } from "@/lib/services/listings";
void getRequestSession; void readJson; void rateLimit;
export const GET = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  const q = listQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listListings({ ...q, ownerId: s.sub }));
});
