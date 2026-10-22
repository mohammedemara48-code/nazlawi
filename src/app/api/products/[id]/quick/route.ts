import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { productQuickSchema } from "@/lib/validation";
import { quickUpdateProduct } from "@/lib/services/catalog";
type Ctx = { params: Promise<{ id: string }> };
/** Quick edits: { price?, oldPrice?, inStock?, featured? } */
export const PATCH = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  return NextResponse.json({ product: await quickUpdateProduct((await params).id, productQuickSchema.parse(await readJson(req)), s) });
});
