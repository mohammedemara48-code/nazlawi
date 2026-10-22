import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { deleteListingImage } from "@/lib/services/listings";
void getRequestSession; void readJson; void rateLimit;
export const DELETE = api<{ params: Promise<{ id: string; imageId: string }> }>(async (req, { params }) => {
  const { id, imageId } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await deleteListingImage(id, imageId, s);
  return new NextResponse(null, { status: 204 });
});
