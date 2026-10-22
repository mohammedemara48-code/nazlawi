import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { reorderSchema } from "@/lib/validation";
import { reorderSections } from "@/lib/services/catalog";
type Ctx = { params: Promise<{ id: string }> };
export const POST = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  return NextResponse.json({ sections: await reorderSections((await params).id, reorderSchema.parse(await readJson(req)).ids, s) });
});
