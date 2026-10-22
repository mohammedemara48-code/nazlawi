import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { pageSchema } from "@/lib/validation";
import { requireSession } from "@/lib/session";
import { listAudit } from "@/lib/services/audit";

export const GET = api(async (req) => {
  await requireSession(req, ["ADMIN"]);
  const { page, pageSize } = pageSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listAudit(page, pageSize));
});
