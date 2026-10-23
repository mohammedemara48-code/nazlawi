import { readFileSync } from "node:fs";
import path from "node:path";

/** Service worker, versioned per deployment (commit SHA) and never HTTP-cached, so every deploy is picked up. */
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev").slice(0, 12);
const BODY = readFileSync(path.join(process.cwd(), "src/lib/sw-template.txt"), "utf8").replace("__BUILD__", BUILD);
export const dynamic = "force-static";
export function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
}
