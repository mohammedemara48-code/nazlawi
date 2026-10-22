import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { restoreStore } from "@/lib/services/trash";

type Ctx = { params: Promise<{ id: string }> };
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await restoreStore(id, s);
  return NextResponse.json({ restored: true });
});
