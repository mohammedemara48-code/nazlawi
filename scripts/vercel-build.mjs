// Vercel build: map integration env names to DATABASE_URL / DIRECT_URL, run migrations, build.
import { execSync } from "node:child_process";
const pg = (v) => (v && /^postgres(ql)?:\/\//.test(v) ? v : undefined);
const e = process.env;
// DB_TARGET=neon selects the NEON_-prefixed integration vars (no fallback to another database).
const neon = e.DB_TARGET === "neon";
const db = neon ? (pg(e.NEON_DATABASE_URL) ?? pg(e.NEON_POSTGRES_URL)) : pg(e.DATABASE_URL) ?? pg(e.POSTGRES_PRISMA_URL) ?? pg(e.POSTGRES_URL) ?? pg(e.DATABASE_URL_UNPOOLED) ?? pg(e.POSTGRES_URL_NON_POOLING);
const direct = neon ? (pg(e.NEON_DATABASE_URL_UNPOOLED) ?? pg(e.NEON_POSTGRES_URL_NON_POOLING)) : pg(e.DIRECT_URL) ?? pg(e.DATABASE_URL_UNPOOLED) ?? pg(e.POSTGRES_URL_NON_POOLING) ?? pg(e.POSTGRES_URL) ?? db;
if (neon && (!db || !direct)) { console.error("[vercel-build] DB_TARGET=neon but NEON_DATABASE_URL / NEON_DATABASE_URL_UNPOOLED are missing."); process.exit(1); }
console.log(`[vercel-build] database target: ${neon ? "neon" : "default"}`);
if (!db) {
  console.error("[vercel-build] No postgres:// database URL found (DATABASE_URL / POSTGRES_URL / ...). Connect a Postgres database.");
  process.exit(1);
}
const env = { ...e, DATABASE_URL: db, DIRECT_URL: direct };
const run = (cmd) => { console.log(`[vercel-build] ${cmd}`); execSync(cmd, { stdio: "inherit", env }); };
run("npx prisma generate");
run("npx prisma migrate deploy");
run("node scripts/bootstrap-admin.mjs");
run("npx next build");
