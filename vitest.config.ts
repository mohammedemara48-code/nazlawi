import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    globalSetup: "./tests/global-setup.ts",
    setupFiles: ["./tests/setup.ts"],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://nazlawi:nazlawi@localhost:5432/nazlawi_test", DIRECT_URL: process.env.TEST_DATABASE_URL ?? "postgresql://nazlawi:nazlawi@localhost:5432/nazlawi_test", STORAGE_DRIVER: "local", AUTH_SECRET: "test-secret-test-secret-test-secret", NODE_ENV: "test", UPLOAD_DIR: "test-uploads", APP_URL: "http://localhost:3100" },
    fileParallelism: false,
  },
});
