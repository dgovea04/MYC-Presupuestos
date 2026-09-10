import { defineConfig } from "vitest/config";
import path from "node:path";

const postgresIntegrationTest = "scripts/backfill-knowledge.integration.test.ts";
const integrationTestWasRequested = process.argv.some((argument) => argument.replaceAll("\\", "/").endsWith(postgresIntegrationTest));

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
      ...(process.env.DATABASE_URL || integrationTestWasRequested ? [] : [postgresIntegrationTest]),
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
