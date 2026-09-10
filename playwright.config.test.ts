import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const repositoryRoot = path.resolve(__dirname);
const tsxCli = path.join(repositoryRoot, "node_modules", "tsx", "dist", "cli.mjs");
const playwrightConfig = path.join(repositoryRoot, "playwright.config.ts");

const bridgeFixture = [
  "E2E_REVIEW_BRIDGE_RUN_ID=run-from-dotenv",
  "E2E_REVIEW_BRIDGE_FINDING_ID=finding-from-dotenv",
  "E2E_REVIEW_BRIDGE_COMPANY_ID=company-from-dotenv",
  "E2E_REVIEW_BRIDGE_PROJECT_ID=project-from-dotenv",
  "E2E_REVIEW_BRIDGE_QUERY=costos de concreto",
  "E2E_REVIEW_BRIDGE_LOCAL=true",
  "E2E_REVIEW_BRIDGE_TEST_DATABASE=true",
].join("\n");

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});

it("detects a complete bridge fixture declared only in the working-directory .env", async () => {
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "myc-playwright-config-"));
  temporaryDirectories.push(workingDirectory);
  await writeFile(path.join(workingDirectory, ".env"), bridgeFixture, "utf8");

  const environment = { ...process.env };
  for (const key of bridgeFixture.split("\n").map((entry) => entry.split("=", 1)[0])) {
    delete environment[key];
  }

  const script = [
    `import config from ${JSON.stringify(playwrightConfig)};`,
    "const webServer = config.webServer;",
    "if (!webServer || Array.isArray(webServer)) throw new Error('Expected a managed web server');",
    "console.log(JSON.stringify({ reuseExistingServer: webServer.reuseExistingServer }));",
  ].join("\n");

  const { stdout } = await execFileAsync(process.execPath, [tsxCli, "-e", script], {
    cwd: workingDirectory,
    env: environment,
  });

  expect(JSON.parse(stdout) as { reuseExistingServer: boolean }).toEqual({ reuseExistingServer: false });
}, 30_000);
