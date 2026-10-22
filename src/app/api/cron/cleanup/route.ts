import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireCron } from "@/lib/cron";
import { cleanupIncoming } from "@/lib/services/cleanup";
import { purgeExpiredTrash } from "@/lib/services/trash";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
/** Vercel Cron: deletes abandoned direct uploads (incoming/ older than 24 h) and purges stores/products soft-deleted > 30 days ago. */
export const GET = api(async (req) => {
  requireCron(req);
  return NextResponse.json({ deleted: await cleanupIncoming(), trash: await purgeExpiredTrash() });
});
