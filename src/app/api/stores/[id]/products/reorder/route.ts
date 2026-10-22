import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { reorderSchema } from "@/lib/validation";
import { reorderProducts } from "@/lib/services/catalog";
type Ctx = { params: Promise<{ id: string }> };
const body = reorderSchema.extend({ sectionId: z.string().cuid().nullable() });
export const POST = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  const b = body.parse(await readJson(req));
  return NextResponse.json({ products: await reorderProducts((await params).id, b.sectionId, b.ids, s) });
});
