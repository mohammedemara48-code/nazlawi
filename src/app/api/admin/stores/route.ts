import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { adminListSchema } from "@/lib/validation";
import { adminListStores } from "@/lib/services/stores";
void getRequestSession; void readJson; void rateLimit;
export const GET = api(async (req) => {
  await requireSession(req, ["ADMIN"]);
  const q = adminListSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await adminListStores(q.status, q.page, q.pageSize));
});
