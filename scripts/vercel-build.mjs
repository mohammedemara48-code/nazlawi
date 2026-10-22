// Vercel build: map integration env names to DATABASE_URL / DIRECT_URL, run migrations, build.
import { execSync } from "node:child_process";
const pg = (v) => (v && /^postgres(ql)?:\/\//.test(v) ? v : undefined);
const e = process.env;
const db = pg(e.DATABASE_URL) ?? pg(e.POSTGRES_PRISMA_URL) ?? pg(e.POSTGRES_URL) ?? pg(e.DATABASE_URL_UNPOOLED) ?? pg(e.POSTGRES_URL_NON_POOLING);
const direct = pg(e.DIRECT_URL) ?? pg(e.DATABASE_URL_UNPOOLED) ?? pg(e.POSTGRES_URL_NON_POOLING) ?? pg(e.POSTGRES_URL) ?? db;
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
