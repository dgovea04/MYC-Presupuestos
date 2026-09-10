import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const knowledgeE2EEnvironment = {
  ...process.env,
  MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE: "true",
  MC_KNOWLEDGE_REVIEW_ENRICHMENT: "true",
  MC_KNOWLEDGE_RETRIEVAL_V1: "true",
  MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE: "true",
  MC_KNOWLEDGE_BACKFILL: "true",
};

const bridgeRetryFixtureKeys = [
  "E2E_REVIEW_BRIDGE_RUN_ID",
  "E2E_REVIEW_BRIDGE_FINDING_ID",
  "E2E_REVIEW_BRIDGE_COMPANY_ID",
  "E2E_REVIEW_BRIDGE_PROJECT_ID",
  "E2E_REVIEW_BRIDGE_QUERY",
  "E2E_REVIEW_BRIDGE_LOCAL",
  "E2E_REVIEW_BRIDGE_TEST_DATABASE",
] as const;

const configuredBridgeRetryFixtureKeys = bridgeRetryFixtureKeys.filter((key) => Boolean(process.env[key]?.trim()));
const bridgeRetryFixtureRequested = configuredBridgeRetryFixtureKeys.length > 0;
const missingBridgeRetryFixtureKeys = bridgeRetryFixtureKeys.filter((key) => !process.env[key]?.trim());

const usesExternalE2EServer = Boolean(process.env.E2E_BASE_URL || process.env.E2E_NO_WEBSERVER);

if (bridgeRetryFixtureRequested && missingBridgeRetryFixtureKeys.length > 0) {
  throw new Error(`El fixture E2E bridge/retry está configurado parcialmente. Define estas variables: ${missingBridgeRetryFixtureKeys.join(", ")}. Solo se permite omitir todas las E2E_REVIEW_BRIDGE_* para saltar el escenario.`);
}

if (bridgeRetryFixtureRequested && usesExternalE2EServer) {
  throw new Error("El escenario bridge/retry requiere el servidor gestionado por Playwright para inyectar las flags Knowledge. No uses E2E_BASE_URL ni E2E_NO_WEBSERVER.");
}

/**
 * Playwright config for the Excel-mode e2e smoke suite.
 *
 * Convention: the suite is *opt-in* - it is not part of the default
 * `npm run test` (vitest). Run it locally with `npm run test:e2e` against
 * `npm run dev` (or `npm run build && npm start`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: usesExternalE2EServer
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        env: knowledgeE2EEnvironment,
        // The bridge/retry test must be served by this process so its Knowledge
        // feature flags are known. Other opt-in E2E tests can still reuse dev.
        reuseExistingServer: !bridgeRetryFixtureRequested,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
