import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { adminQuerySchema } from "@/lib/validation";
import { listListings } from "@/lib/services/listings";
void getRequestSession; void readJson; void rateLimit;
export const GET = api(async (req) => {
  await requireSession(req, ["ADMIN"]);
  return NextResponse.json(await listListings(adminQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams))));
});
