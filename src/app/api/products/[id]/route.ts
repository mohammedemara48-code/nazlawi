import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { productUpdateSchema } from "@/lib/validation";
import { deleteProduct, getProduct, updateProduct } from "@/lib/services/catalog";
type Ctx = { params: Promise<{ id: string }> };
export const GET = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  return NextResponse.json({ product: await getProduct((await params).id, s) });
});
export const PATCH = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  return NextResponse.json({ product: await updateProduct((await params).id, productUpdateSchema.parse(await readJson(req)), s) });
});
export const DELETE = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  await deleteProduct((await params).id, s);
  return new NextResponse(null, { status: 204 });
});
