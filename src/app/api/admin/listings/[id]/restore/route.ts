import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { restoreListing } from "@/lib/services/trash";

type Ctx = { params: Promise<{ id: string }> };
export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await restoreListing(id, s);
  return NextResponse.json({ restored: true });
});
