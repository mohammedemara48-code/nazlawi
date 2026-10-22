import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { requireSession, getRequestSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { groupSchema } from "@/lib/validation";
import { updateGroup, deleteGroup } from "@/lib/services/stores";
void getRequestSession; void rateLimit;
type C = { params: Promise<{ id: string; groupId: string }> };
export const PATCH = api<C>(async (req, { params }) => {
  const { id, groupId } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  return NextResponse.json({ group: await updateGroup(id, groupId, groupSchema.partial().parse(await readJson(req)), s) });
});
export const DELETE = api<C>(async (req, { params }) => {
  const { id, groupId } = await params;
  const s = await requireSession(req, ["PROVIDER", "ADMIN"]);
  await deleteGroup(id, groupId, s);
  return new NextResponse(null, { status: 204 });
});
