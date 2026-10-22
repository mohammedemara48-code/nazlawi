import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireCron } from "@/lib/cron";
import { cleanupIncoming } from "@/lib/services/cleanup";

export const dynamic = "force-dynamic";
/** Vercel Cron: deletes abandoned direct uploads (incoming/ older than 24 h, not referenced by a queued video). */
export const GET = api(async (req) => {
  requireCron(req);
  return NextResponse.json({ deleted: await cleanupIncoming() });
});
