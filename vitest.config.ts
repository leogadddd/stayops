import { defineConfig } from "vitest/config";
import path from "node:path";

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
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    env: {
      // The db client is constructed at import time; unit tests never
      // connect, they just need the module to load.
      DATABASE_URL: "postgres://test:test@localhost:5432/stayops_test",
      BETTER_AUTH_SECRET: "vitest-secret",
    },
  },
});
