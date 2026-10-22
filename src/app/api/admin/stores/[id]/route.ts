import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { softDeleteStore, purgeStore } from "@/lib/services/trash";

type Ctx = { params: Promise<{ id: string }> };
/** Admin delete: soft by default (restorable for 30 days); `?hard=1` deletes permanently (rows + files). */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-mod:${s.sub}`, 120, 60_000);
  if (new URL(req.url).searchParams.get("hard") === "1") { await purgeStore(id, s); return NextResponse.json({ purged: true }); }
  await softDeleteStore(id, s);
  return NextResponse.json({ deleted: true });
});
