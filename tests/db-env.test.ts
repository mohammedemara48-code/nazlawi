import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl, resolveDirectUrl } from "../src/lib/db-env";

const base = { DATABASE_URL: "postgres://prisma/db", POSTGRES_URL: "postgres://prisma/direct", NEON_DATABASE_URL: "postgres://neon-pool/db", NEON_DATABASE_URL_UNPOOLED: "postgres://neon/db" };
describe("db-env", () => {
  it("defaults to DATABASE_URL and ignores NEON_* vars", () => {
    expect(resolveDatabaseUrl(base)).toBe("postgres://prisma/db");
    expect(resolveDirectUrl(base)).toBe("postgres://prisma/direct");
  });
  it("DB_TARGET=neon selects Neon pooled + unpooled", () => {
    expect(resolveDatabaseUrl({ ...base, DB_TARGET: "neon" })).toBe("postgres://neon-pool/db");
    expect(resolveDirectUrl({ ...base, DB_TARGET: "neon" })).toBe("postgres://neon/db");
  });
  it("DB_TARGET=neon never falls back to another database", () => {
    expect(() => resolveDatabaseUrl({ DATABASE_URL: "postgres://prisma/db", DB_TARGET: "neon" })).toThrow(/NEON_DATABASE_URL/);
    expect(() => resolveDirectUrl({ DATABASE_URL: "postgres://prisma/db", NEON_DATABASE_URL: "postgres://n/db", DB_TARGET: "neon" })).toThrow(/UNPOOLED/);
  });
});
