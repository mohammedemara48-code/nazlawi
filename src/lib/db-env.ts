/**
 * Resolves database URLs from our names or the names Vercel integrations create
 * (Prisma Postgres / Neon / Vercel Postgres). Only plain postgres:// URLs are accepted for the pooled URL;
 * prisma+postgres:// (Accelerate) URLs are skipped because this app doesn't use the Accelerate extension.
 */
type Env = Record<string, string | undefined>;
const pg = (v?: string) => (v && /^postgres(ql)?:\/\//.test(v) ? v : undefined);
/**
 * DB_TARGET=neon (a plain, non-secret flag) selects the NEON_-prefixed vars the Neon integration created.
 * It never falls back to another database: a missing Neon URL is a hard error.
 */
const neon = (env: Env) => env.DB_TARGET === "neon";
function need(v: string | undefined, name: string) {
  if (!v) throw new Error(`DB_TARGET=neon but ${name} is missing`);
  return v;
}
export function resolveDatabaseUrl(env: Env = process.env) {
  if (neon(env)) return need(pg(env.NEON_DATABASE_URL) ?? pg(env.NEON_POSTGRES_URL), "NEON_DATABASE_URL");
  return pg(env.DATABASE_URL) ?? pg(env.POSTGRES_PRISMA_URL) ?? pg(env.POSTGRES_URL) ?? pg(env.DATABASE_URL_UNPOOLED) ?? pg(env.POSTGRES_URL_NON_POOLING);
}
export function resolveDirectUrl(env: Env = process.env) {
  if (neon(env)) return need(pg(env.NEON_DATABASE_URL_UNPOOLED) ?? pg(env.NEON_POSTGRES_URL_NON_POOLING), "NEON_DATABASE_URL_UNPOOLED");
  return pg(env.DIRECT_URL) ?? pg(env.DATABASE_URL_UNPOOLED) ?? pg(env.POSTGRES_URL_NON_POOLING) ?? pg(env.POSTGRES_URL) ?? resolveDatabaseUrl(env);
}
