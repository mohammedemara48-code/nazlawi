import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { storeUpdateSchema } from "@/lib/validation";
import { updateStore } from "@/lib/services/stores";
void getRequestSession;
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`store-update:${s.sub}`, 30, 15 * 60_000);
  const input = storeUpdateSchema.parse(await readJson(req));
  return NextResponse.json({ store: await updateStore(id, input, s) });
});
