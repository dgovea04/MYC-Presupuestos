import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";
const REVIEW_BUDGET_PATH = process.env.E2E_REVIEW_BUDGET_PATH;
const REVIEW_XLSX_FIXTURE = process.env.E2E_REVIEW_XLSX_FIXTURE;
const REVIEW_BRIDGE_RUN_ID = process.env.E2E_REVIEW_BRIDGE_RUN_ID;
const REVIEW_BRIDGE_FINDING_ID = process.env.E2E_REVIEW_BRIDGE_FINDING_ID;
const REVIEW_BRIDGE_COMPANY_ID = process.env.E2E_REVIEW_BRIDGE_COMPANY_ID;
const REVIEW_BRIDGE_PROJECT_ID = process.env.E2E_REVIEW_BRIDGE_PROJECT_ID;
const REVIEW_BRIDGE_QUERY = process.env.E2E_REVIEW_BRIDGE_QUERY;
const REVIEW_BRIDGE_RETRY_JOB_ID = process.env.E2E_REVIEW_BRIDGE_RETRY_JOB_ID;
const REVIEW_BRIDGE_RETRY_YIELD_KEY = process.env.E2E_REVIEW_BRIDGE_RETRY_YIELD_KEY;
const execFileAsync = promisify(execFile);

type ReviewFindingResponse = {
  findings?: Array<{ id: string; updatedAt: string }>;
};

type KnowledgeQueueResponse = {
  retryableJobs?: Array<{ id: string; status: string }>;
};

type KnowledgeRetrievalResponse = {
  yields?: Array<{ idempotencyKey?: string | null }>;
};

const knowledgeE2EEnvironment = {
  ...process.env,
  MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE: "true",
  MC_KNOWLEDGE_REVIEW_ENRICHMENT: "true",
  MC_KNOWLEDGE_RETRIEVAL_V1: "true",
  MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE: "true",
  MC_KNOWLEDGE_BACKFILL: "true",
};

function hasBridgeRetryFixture(): boolean {
  return [
    REVIEW_BRIDGE_RUN_ID,
    REVIEW_BRIDGE_FINDING_ID,
    REVIEW_BRIDGE_COMPANY_ID,
    REVIEW_BRIDGE_PROJECT_ID,
    REVIEW_BRIDGE_QUERY,
    REVIEW_BRIDGE_RETRY_JOB_ID,
    REVIEW_BRIDGE_RETRY_YIELD_KEY,
  ].every(Boolean);
}

async function runKnowledgeWorker(): Promise<void> {
  await execFileAsync(
    process.execPath,
    ["./node_modules/tsx/dist/cli.mjs", "scripts/process-knowledge-integration-jobs.ts"],
    { cwd: process.cwd(), env: knowledgeE2EEnvironment, timeout: 60_000 },
  );
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /iniciar sesi[oó]n/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/correo|email/i).fill(E2E_USER_EMAIL);
  await page.getByLabel(/contrase[ñn]a|password/i).fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test.describe("Revisión Inteligente", () => {
  test.skip(!REVIEW_BUDGET_PATH || !REVIEW_XLSX_FIXTURE, "Configura E2E_REVIEW_BUDGET_PATH y E2E_REVIEW_XLSX_FIXTURE para ejecutar el flujo autenticado.");

  test("carga, confirma clasificación, selecciona hojas y crea una revisión", async ({ page }) => {
    await signIn(page);
    await page.goto(REVIEW_BUDGET_PATH!);
    await expect(page.getByTestId("review-intelligence-page")).toBeVisible();

    await page.getByRole("button", { name: "Cargar documento PDF o XLSX" }).click();
    await page.getByLabel("Archivo PDF o XLSX").setInputFiles(REVIEW_XLSX_FIXTURE!);
    await expect(page.getByTestId("review-document-manager")).toContainText(/Metrados|documento/i);

    const suggestion = page.getByRole("button", { name: /Usar sugerencia/i }).first();
    if (await suggestion.count()) await suggestion.click();
    const sheet = page.getByRole("checkbox", { name: /Incluir hoja/i }).first();
    if (await sheet.count()) await sheet.check();
    const document = page.getByRole("checkbox", { name: /Incluir .* en la revisión/i }).first();
    await document.check();
    await page.getByRole("button", { name: "Iniciar revisión" }).click();
    await expect(page.getByText(/Ejecuciones guardadas|Procesando|Completada/i)).toBeVisible({ timeout: 60_000 });
  });

  test("renders persisted V1 coverage, enriched findings, and the human-review guardrail", async ({ page }) => {
    await signIn(page);

    const budgetWriteRequests: Array<{ method: string; url: string }> = [];
    page.on("request", (request) => {
      if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return;

      const url = request.url();
      const pathname = new URL(url).pathname;
      const writesBudget = /^\/api\/budgets\/[^/]+$/.test(pathname);
      const writesBudgetItem = /^\/api\/budget-items\/[^/]+\/.+/.test(pathname);
      if (writesBudget || writesBudgetItem) budgetWriteRequests.push({ method: request.method(), url });
    });

    const completedRun = {
      id: "review-v1",
      status: "COMPLETED",
      progressJson: {
        stage: "completed",
        completed: 8,
        total: 8,
        percent: 100,
        metrics: {
          coverageByCategory: { quantity: 12, unit: 9, specification: 7, apuComponent: 4, yield: 3 },
          partiallyCoveredSources: 2,
        },
      },
      warningsJson: [],
      createdAt: "2026-09-06T12:00:00.000Z",
      updatedAt: "2026-09-06T12:05:00.000Z",
    };
    const finding = (id: string, code: string, findingType: string, comparison: Record<string, unknown>) => ({
      id,
      findingType,
      status: "PENDING",
      severity: "HIGH",
      priority: "0.90",
      confidence: "HIGH",
      potentialImpact: "540.00",
      updatedAt: "2026-09-06T12:05:00.000Z",
      humanReviewRequired: true,
      automaticBudgetMutation: false,
      budgetItem: { id: `item-${id}`, code, description: "Concreto estructural", unit: "m3", quantity: "4.000", unitPrice: "135.00" },
      comparison,
      evidence: {
        id: `evidence-${id}`,
        documentVersionId: "version-v1",
        evidenceType: "QUANTITY",
        originalText: "Concreto estructural",
        normalizedText: "Concreto estructural",
        value: "8.000",
        unit: "m3",
        sourceName: "Metrados.xlsx",
        location: { sheet: "Metrados", row: 12, column: 4, range: "D12" },
        confidence: "HIGH",
        extractionMethod: "XLSX_CELL_RANGE",
      },
      decisionHistory: [],
    });
    const findings = [
      finding("yield", "MAT-001", "YIELD_MISMATCH", { documentValue: "8.000", budgetValue: "4.000", difference: "4.000", unit: "m3" }),
      finding("specification", "ESP-001", "TECHNICAL_SPEC_MISMATCH", { details: { documentSpecification: "Concreto f'c 210", budgetSpecification: "Concreto f'c 280" } }),
      finding("apu", "APU-001", "INCOMPLETE_APU", { details: { missingComponents: "arena, aditivo" } }),
    ];

    await page.route(/\/api\/projects\/[^/]+\/review-documents(?:\?.*)?$/, (route) => route.fulfill({ json: { documents: [] } }));
    await page.route(/\/api\/budgets\/[^/]+\/review-runs\?.*$/, (route) => route.fulfill({ json: { runs: [completedRun] } }));
    await page.route(/\/api\/review-runs\/review-v1\/findings\?.*$/, (route) => route.fulfill({ json: { findings, page: 1, pageSize: 25, hasNextPage: false } }));
    await page.route((url) => url.pathname === "/api/review-runs/review-v1", (route) => route.fulfill({ json: { status: completedRun.status, progress: completedRun.progressJson } }));

    await page.goto(REVIEW_BUDGET_PATH!);

    const coverage = page.getByRole("region", { name: "Cobertura por categoría" });
    await expect(coverage).toContainText("Metrados");
    await expect(coverage).toContainText("12");
    await expect(coverage).toContainText("Unidades");
    await expect(coverage).toContainText("9");
    await expect(coverage).toContainText("Especificaciones");
    await expect(coverage).toContainText("7");
    await expect(coverage).toContainText("APU");
    await expect(coverage).toContainText("4");
    await expect(coverage).toContainText("Rendimientos");
    await expect(coverage).toContainText("3");
    await expect(page.getByRole("status", { name: "Advertencia de cobertura parcial" })).toContainText("2 fuentes con cobertura parcial");

    await page.getByRole("button", { name: "Abrir hallazgo MAT-001" }).click();
    await expect(page.getByRole("region", { name: "Detalle de rendimiento" })).toContainText("8.000");
    await expect(page.getByRole("region", { name: "Detalle de rendimiento" })).toContainText("4.000");

    await page.getByRole("button", { name: "Abrir hallazgo ESP-001" }).click();
    await expect(page.getByRole("region", { name: "Detalle de especificación" })).toContainText("Concreto f'c 210");
    await expect(page.getByRole("region", { name: "Detalle de especificación" })).toContainText("Concreto f'c 280");

    await page.getByRole("button", { name: "Abrir hallazgo APU-001" }).click();
    await expect(page.getByRole("region", { name: "Detalle de componentes APU" })).toContainText("arena, aditivo");
    await expect(page.getByText(/Revisión humana requerida\. El presupuesto no se modifica automáticamente\./i)).toBeVisible();
    expect(budgetWriteRequests).toEqual([]);
  });

  test("does not expose review documents across workspace boundaries", async ({ page }) => {
    await signIn(page);
    const response = await page.request.get("/api/projects/foreign-project/review-documents");
    expect([403, 404]).toContain(response.status());
  });
});

test.describe("Knowledge bridge retry", () => {
  test("bridges a review decision into Knowledge and completes a retry idempotently", async ({ page }) => {
    test.skip(!hasBridgeRetryFixture(), "Configura el fixture E2E_REVIEW_BRIDGE_* para el escenario bridge/retry contra PostgreSQL local.");
    await signIn(page);

    const findingsResponse = await page.request.get(`/api/review-runs/${REVIEW_BRIDGE_RUN_ID}/findings?page=1&pageSize=100`);
    expect(findingsResponse.status(), await findingsResponse.text()).toBe(200);
    const findings = await findingsResponse.json() as ReviewFindingResponse;
    const finding = findings.findings?.find((entry) => entry.id === REVIEW_BRIDGE_FINDING_ID);
    expect(finding).toBeTruthy();

    const decisionResponse = await page.request.post(`/api/review-findings/${REVIEW_BRIDGE_FINDING_ID}/decisions`, {
      data: {
        resolution: "CONFIRMED_ISSUE",
        note: "E2E bridge/retry verification",
        expectedUpdatedAt: finding?.updatedAt,
      },
    });
    expect(decisionResponse.status(), await decisionResponse.text()).toBe(201);

    await expect.poll(async () => {
      const response = await page.request.get(`/api/knowledge/retrieval?q=${encodeURIComponent(REVIEW_BRIDGE_QUERY ?? "")}&projectId=${encodeURIComponent(REVIEW_BRIDGE_PROJECT_ID ?? "")}`);
      if (!response.ok()) return 0;
      const retrieval = await response.json() as KnowledgeRetrievalResponse;
      return retrieval.yields?.filter((yieldObservation) => yieldObservation.idempotencyKey?.startsWith("review-yield:")).length ?? 0;
    }, { timeout: 30_000 }).toBeGreaterThan(0);

    const queueUrl = `/api/admin/knowledge/queue?companyId=${encodeURIComponent(REVIEW_BRIDGE_COMPANY_ID ?? "")}&projectId=${encodeURIComponent(REVIEW_BRIDGE_PROJECT_ID ?? "")}`;
    await expect.poll(async () => {
      const response = await page.request.get(queueUrl);
      if (!response.ok()) return undefined;
      const queue = await response.json() as KnowledgeQueueResponse;
      return queue.retryableJobs?.find((job) => job.id === REVIEW_BRIDGE_RETRY_JOB_ID)?.status;
    }, { timeout: 30_000 }).toBe("RETRYABLE_FAILED");

    const retryResponse = await page.request.post(`/api/admin/knowledge/jobs/${REVIEW_BRIDGE_RETRY_JOB_ID}/retry`);
    expect(retryResponse.status(), await retryResponse.text()).toBe(200);
    await expect.poll(async () => {
      const response = await page.request.get(queueUrl);
      if (!response.ok()) return undefined;
      const queue = await response.json() as KnowledgeQueueResponse;
      return queue.retryableJobs?.find((job) => job.id === REVIEW_BRIDGE_RETRY_JOB_ID)?.status;
    }, { timeout: 30_000 }).toBe("PENDING");

    await runKnowledgeWorker();
    await expect.poll(async () => {
      const response = await page.request.get(queueUrl);
      if (!response.ok()) return undefined;
      const queue = await response.json() as KnowledgeQueueResponse;
      return queue.retryableJobs?.find((job) => job.id === REVIEW_BRIDGE_RETRY_JOB_ID)?.status;
    }, { timeout: 30_000 }).toBe("SUCCEEDED");

    const retryYieldCount = async (): Promise<number> => {
      const response = await page.request.get(`/api/knowledge/retrieval?q=${encodeURIComponent(REVIEW_BRIDGE_QUERY ?? "")}&projectId=${encodeURIComponent(REVIEW_BRIDGE_PROJECT_ID ?? "")}`);
      expect(response.status(), await response.text()).toBe(200);
      const retrieval = await response.json() as KnowledgeRetrievalResponse;
      return retrieval.yields?.filter((yieldObservation) => yieldObservation.idempotencyKey === REVIEW_BRIDGE_RETRY_YIELD_KEY).length ?? 0;
    };

    expect(await retryYieldCount()).toBe(1);
    await runKnowledgeWorker();
    expect(await retryYieldCount()).toBe(1);
  });
});
