import { defineConfig } from "vitest/config";
import path from "node:path";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ??
  "postgres://stayops:stayops@localhost:5432/stayops_test";
if (new URL(testDatabaseUrl).pathname !== "/stayops_test") {
  throw new Error("Integration tests require a dedicated stayops_test database.");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/helpers/server-only-stub.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/reset.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_SECRET: "vitest-secret",
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
