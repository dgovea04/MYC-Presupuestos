import { defineConfig } from "vitest/config";
import path from "node:path";

const postgresIntegrationTest = "scripts/backfill-knowledge.integration.test.ts";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.worktrees/**",
      "tests/e2e/**",
      "playwright-report/**",
      "test-results/**",
      ...(process.env.DATABASE_URL ? [] : [postgresIntegrationTest]),
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
