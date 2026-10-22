import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { purgeStore } from "@/lib/services/trash";

type Ctx = { params: Promise<{ id: string }> };
/** Admin delete is permanent: rows (cascade) + stored files, then public caches are revalidated. */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-mod:${s.sub}`, 120, 60_000);
  await purgeStore(id, s);
  return NextResponse.json({ deleted: true, purged: true });
});
