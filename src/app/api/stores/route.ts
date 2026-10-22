import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { storeCreateSchema, storeQuerySchema } from "@/lib/validation";
import { createStore, listStores } from "@/lib/services/stores";
void getRequestSession;
/** Public: stores in a section, each with up to 3 featured listings. */
export const GET = api(async (req) => {
  const q = storeQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listStores(q));
});
/** Provider onboarding: create the store (section required). */
export const POST = api(async (req) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`store-create:${s.sub}`, 5, 60 * 60_000);
  const input = storeCreateSchema.parse(await readJson(req));
  return NextResponse.json({ store: await createStore(input, s) }, { status: 201 });
});
