import { NextResponse } from "next/server";
import { api, readJson } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { adminUserUpdateSchema } from "@/lib/validation";
import { requireSession } from "@/lib/session";
import { updateUser } from "@/lib/services/admin-users";

/** Body: { role?, status? } */
export const PATCH = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`admin-users:${s.sub}`, 60, 60_000);
  const change = adminUserUpdateSchema.parse(await readJson(req));
  return NextResponse.json({ user: await updateUser(s, id, change) });
});
