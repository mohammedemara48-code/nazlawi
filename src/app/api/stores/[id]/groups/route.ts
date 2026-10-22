import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { groupSchema } from "@/lib/validation";
import { addGroup } from "@/lib/services/stores";
void getRequestSession;
type Ctx = { params: Promise<{ id: string }> };
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`groups:${s.sub}`, 60, 15 * 60_000);
  return NextResponse.json({ group: await addGroup(id, groupSchema.parse(await readJson(req)), s) }, { status: 201 });
});
