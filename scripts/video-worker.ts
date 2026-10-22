// Standalone video worker: polls VideoJob and transcodes with ffmpeg.
// Run: `npm run worker` (needs DATABASE_URL, STORAGE_DRIVER/BLOB_READ_WRITE_TOKEN, ffmpeg+ffprobe on PATH).
// `npm run worker -- --once` processes what's queued and exits (useful for CI/cron).
import { claimVideoJob, runVideoJob } from "../src/lib/services/videos";
import { prisma } from "../src/lib/db";

const once = process.argv.includes("--once");
const idleMs = Number(process.env.WORKER_POLL_MS ?? 5000);
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; console.log(`[worker] ${sig}: finishing current job`); });

async function main() {
  console.log(`[worker] started (${once ? "once" : `poll ${idleMs} ms`})`);
  while (!stopping) {
    const job = await claimVideoJob();
    if (job) {
      const t = Date.now();
      const r = await runVideoJob(job);
      console.log(`[worker] job ${job.id} video ${job.videoId} attempt ${job.attempts}: ${r} in ${Date.now() - t} ms`);
      continue;
    }
    if (once) break;
    await new Promise((res) => setTimeout(res, idleMs));
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
