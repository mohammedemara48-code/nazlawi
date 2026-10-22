import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getUser } from "@/lib/services/users";
export const GET = api(async (req) => {
  const s = await requireSession(req);
  const user = await getUser(s.sub);
  if (!user) throw new ApiError("UNAUTHORIZED");
  return NextResponse.json({ user });
});
