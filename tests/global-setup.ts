import { execSync } from "node:child_process";
/** Resets the dedicated Postgres test database and applies all migrations. Never point this at a real database. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://nazlawi:nazlawi@localhost:5432/nazlawi_test";
  if (!/_test\b/.test(url)) throw new Error("TEST_DATABASE_URL must point at a *_test database");
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "ignore" });
}
