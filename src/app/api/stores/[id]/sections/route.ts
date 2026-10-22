import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { sectionSchema } from "@/lib/validation";
import { createSection, listSections } from "@/lib/services/catalog";
type Ctx = { params: Promise<{ id: string }> };
export const GET = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  return NextResponse.json({ sections: await listSections((await params).id, s) });
});
export const POST = api<Ctx>(async (req, { params }) => {
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await rateLimit(`catalog-write:${s.sub}`, 300, 15 * 60_000);
  return NextResponse.json({ section: await createSection((await params).id, sectionSchema.parse(await readJson(req)), s) }, { status: 201 });
});
