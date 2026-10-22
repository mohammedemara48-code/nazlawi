import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { storePageQuerySchema } from "@/lib/validation";
import { storePage } from "@/lib/services/stores";
void requireSession; void readJson; void rateLimit;
/** Store page data: store, video, groups, featured and paginated listings (?group=&page=). */
export const GET = api<{ params: Promise<{ slug: string }> }>(async (req, { params }) => {
  const { slug } = await params;
  const q = storePageQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await storePage(slug, await getRequestSession(req), q));
});
