import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { sectionUpdateSchema } from "@/lib/validation";
import { deleteSection, renameSection } from "@/lib/services/catalog";
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  return NextResponse.json({ section: await renameSection((await params).id, sectionUpdateSchema.parse(await readJson(req)), s) });
});
/** Products in the section move to "other". */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  return NextResponse.json(await deleteSection((await params).id, s));
});
