/**
 * Resolves database URLs from our names or the names Vercel integrations create
 * (Prisma Postgres / Neon / Vercel Postgres). Only plain postgres:// URLs are accepted for the pooled URL;
 * prisma+postgres:// (Accelerate) URLs are skipped because this app doesn't use the Accelerate extension.
 */
type Env = Record<string, string | undefined>;
const pg = (v?: string) => (v && /^postgres(ql)?:\/\//.test(v) ? v : undefined);
export function resolveDatabaseUrl(env: Env = process.env) {
  return pg(env.DATABASE_URL) ?? pg(env.POSTGRES_PRISMA_URL) ?? pg(env.POSTGRES_URL) ?? pg(env.DATABASE_URL_UNPOOLED) ?? pg(env.POSTGRES_URL_NON_POOLING);
}
export function resolveDirectUrl(env: Env = process.env) {
  return pg(env.DIRECT_URL) ?? pg(env.DATABASE_URL_UNPOOLED) ?? pg(env.POSTGRES_URL_NON_POOLING) ?? pg(env.POSTGRES_URL) ?? resolveDatabaseUrl(env);
}
