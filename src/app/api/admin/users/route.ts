import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { adminUsersQuerySchema } from "@/lib/validation";
import { requireSession } from "@/lib/session";
import { listUsers } from "@/lib/services/admin-users";

export const GET = api(async (req) => {
  await requireSession(req, ["ADMIN"]);
  const q = adminUsersQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listUsers(q));
});
