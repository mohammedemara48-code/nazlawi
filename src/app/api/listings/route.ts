import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { listQuerySchema, listingCreateSchema } from "@/lib/validation";
import { listPublic, createListing } from "@/lib/services/listings";
void getRequestSession;

/** Public search across approved listings. */
export const GET = api(async (req) => {
  const q = listQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listPublic(q));
});
export const POST = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`listing-create:${s.sub}`, 30, 60 * 60_000);
  const input = listingCreateSchema.parse(await readJson(req));
  return NextResponse.json({ listing: await createListing(input, s) }, { status: 201 });
});
