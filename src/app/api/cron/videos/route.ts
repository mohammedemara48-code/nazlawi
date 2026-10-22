import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireCron } from "@/lib/cron";
import { runPendingVideoJobs } from "@/lib/services/videos";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds (Vercel Pro/Fluid); short clips only — use the worker for heavy loads.
/** Vercel Cron: processes queued video jobs within a time budget. Requires ffmpeg/ffprobe on PATH (see docs/DEPLOY.md). */
export const GET = api(async (req) => {
  requireCron(req);
  return NextResponse.json({ processed: await runPendingVideoJobs({ max: 3, budgetMs: 240_000 }) });
});
