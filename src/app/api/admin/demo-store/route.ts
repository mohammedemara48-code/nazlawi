import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { createDemoStore, removeDemoStore } from "@/lib/services/demo";
import { toEgE164 } from "@/lib/validation";

/** Admin: create (idempotent) or remove the demo grocery store. */
export const POST = api(async (req) => {
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`demo-store:${s.sub}`, 10, 60 * 60_000);
  const r = await createDemoStore(s, { whatsapp: process.env.DEMO_WHATSAPP ? toEgE164(process.env.DEMO_WHATSAPP) : null });
  return NextResponse.json({ slug: r.store.slug, created: r.created }, { status: r.created ? 201 : 200 });
});
export const DELETE = api(async (req) => {
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`demo-store:${s.sub}`, 10, 60 * 60_000);
  return NextResponse.json(await removeDemoStore(s));
});
