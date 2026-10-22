import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { listingUpdateSchema } from "@/lib/validation";
import { getListing, updateListing, deleteListing } from "@/lib/services/listings";
void rateLimit;
type Ctx = { params: Promise<{ id: string }> };
export const GET = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return NextResponse.json({ listing: await getListing(id, await getRequestSession(req)) });
});
export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  const input = listingUpdateSchema.parse(await readJson(req));
  return NextResponse.json({ listing: await updateListing(id, input, s) });
});
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await deleteListing(id, s);
  return new NextResponse(null, { status: 204 });
});
