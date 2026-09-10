import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/db/prisma-client";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";
const REVIEW_BUDGET_PATH = process.env.E2E_REVIEW_BUDGET_PATH;
const REVIEW_XLSX_FIXTURE = process.env.E2E_REVIEW_XLSX_FIXTURE;
const REVIEW_BRIDGE_RUN_ID = process.env.E2E_REVIEW_BRIDGE_RUN_ID;
const REVIEW_BRIDGE_FINDING_ID = process.env.E2E_REVIEW_BRIDGE_FINDING_ID;
const REVIEW_BRIDGE_COMPANY_ID = process.env.E2E_REVIEW_BRIDGE_COMPANY_ID;
const REVIEW_BRIDGE_PROJECT_ID = process.env.E2E_REVIEW_BRIDGE_PROJECT_ID;
const REVIEW_BRIDGE_QUERY = process.env.E2E_REVIEW_BRIDGE_QUERY;
const REVIEW_BRIDGE_LOCAL = process.env.E2E_REVIEW_BRIDGE_LOCAL;
const REVIEW_BRIDGE_TEST_DATABASE = process.env.E2E_REVIEW_BRIDGE_TEST_DATABASE;
const execFileAsync = promisify(execFile);

const BRIDGE_FIXTURE_ENVIRONMENT = {
  E2E_REVIEW_BRIDGE_RUN_ID: REVIEW_BRIDGE_RUN_ID,
  E2E_REVIEW_BRIDGE_FINDING_ID: REVIEW_BRIDGE_FINDING_ID,
  E2E_REVIEW_BRIDGE_COMPANY_ID: REVIEW_BRIDGE_COMPANY_ID,
  E2E_REVIEW_BRIDGE_PROJECT_ID: REVIEW_BRIDGE_PROJECT_ID,
  E2E_REVIEW_BRIDGE_QUERY: REVIEW_BRIDGE_QUERY,
  E2E_REVIEW_BRIDGE_LOCAL: REVIEW_BRIDGE_LOCAL,
  E2E_REVIEW_BRIDGE_TEST_DATABASE: REVIEW_BRIDGE_TEST_DATABASE,
} as const;

const KNOWLEDGE_RETRY_TRIGGER = "e2e_knowledge_yield_retry_trigger";
const KNOWLEDGE_RETRY_FUNCTION = "e2e_knowledge_yield_retry_failure";
const KNOWLEDGE_RETRY_CONTROL_TABLE = "e2e_knowledge_retry_control";

type ReviewFindingResponse = {
  findings?: Array<{ id: string; companyId: string; projectId: string; reviewRunId: string; updatedAt: string }>;
};

type KnowledgeQueueResponse = {
  retryableJobs?: Array<{
    id: string;
    idempotencyKey: string;
    status: string;
    companyId: string;
    projectId: string;
    findingId: string;
    decisionId: string;
  }>;
};

type KnowledgeRetrievalResponse = {
  yields?: Array<{ idempotencyKey?: string | null; companyId?: string | null; projectId?: string | null }>;
};

const knowledgeE2EEnvironment = {
  ...process.env,
  MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE: "true",
  MC_KNOWLEDGE_REVIEW_ENRICHMENT: "true",
  MC_KNOWLEDGE_RETRIEVAL_V1: "true",
  MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE: "true",
  MC_KNOWLEDGE_BACKFILL: "true",
};

function bridgeFixtureState(): "absent" | "configured" {
  const entries = Object.entries(BRIDGE_FIXTURE_ENVIRONMENT);
  const configured = entries.filter(([, value]) => Boolean(value?.trim()));
  if (configured.length === 0) return "absent";

  const missing = entries.filter(([, value]) => !value?.trim()).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`El fixture E2E bridge/retry está configurado parcialmente. Define estas variables: ${missing.join(", ")}. Solo se permite omitir todas las E2E_REVIEW_BRIDGE_* para saltar el escenario.`);
  }
  return "configured";
}

function assertLocalBridgeEnvironment(): void {
  if (REVIEW_BRIDGE_LOCAL !== "true" || REVIEW_BRIDGE_TEST_DATABASE !== "true") {
    throw new Error("El fixture bridge/retry requiere E2E_REVIEW_BRIDGE_LOCAL=true y E2E_REVIEW_BRIDGE_TEST_DATABASE=true.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("El escenario bridge/retry está bloqueado en NODE_ENV=production.");
  }
  if (process.env.E2E_BASE_URL || process.env.E2E_NO_WEBSERVER) {
    throw new Error("El escenario bridge/retry requiere el servidor gestionado por Playwright para inyectar las flags Knowledge. No uses E2E_BASE_URL ni E2E_NO_WEBSERVER.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("El fixture bridge/retry requiere DATABASE_URL de PostgreSQL local.");
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL no es una URL válida de PostgreSQL local para el fixture bridge/retry.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol) || !localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("El fixture bridge/retry solo admite DATABASE_URL PostgreSQL con host localhost, 127.0.0.1 o ::1.");
  }
}

function bridgePrisma(): PrismaClient {
  return createPrismaClient(["error"]);
}

async function assertFixtureRelationships(prisma: PrismaClient): Promise<void> {
  const [project, run, finding] = await Promise.all([
    prisma.project.findFirst({
      where: { id: REVIEW_BRIDGE_PROJECT_ID!, companyId: REVIEW_BRIDGE_COMPANY_ID! },
      select: { id: true, companyId: true },
    }),
    prisma.reviewRun.findFirst({
      where: { id: REVIEW_BRIDGE_RUN_ID!, companyId: REVIEW_BRIDGE_COMPANY_ID!, projectId: REVIEW_BRIDGE_PROJECT_ID! },
      select: { id: true, companyId: true, projectId: true },
    }),
    prisma.reviewFinding.findFirst({
      where: {
        id: REVIEW_BRIDGE_FINDING_ID!,
        companyId: REVIEW_BRIDGE_COMPANY_ID!,
        projectId: REVIEW_BRIDGE_PROJECT_ID!,
        reviewRunId: REVIEW_BRIDGE_RUN_ID!,
      },
      select: { id: true, companyId: true, projectId: true, reviewRunId: true },
    }),
  ]);

  if (!project || !run || !finding) {
    throw new Error("El fixture bridge/retry no está aislado o contiene relaciones inválidas: project, run y finding deben pertenecer al mismo companyId/projectId y finding debe pertenecer al run indicado.");
  }
}

async function installRetryFailureTrigger(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.${KNOWLEDGE_RETRY_CONTROL_TABLE} ("companyId" TEXT NOT NULL, "projectId" TEXT NOT NULL, PRIMARY KEY ("companyId", "projectId"))`);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION public.${KNOWLEDGE_RETRY_FUNCTION}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."idempotencyKey" LIKE 'review-yield:%' AND EXISTS (SELECT 1 FROM public.${KNOWLEDGE_RETRY_CONTROL_TABLE} WHERE "companyId" = NEW."companyId" AND "projectId" = NEW."projectId") THEN RAISE EXCEPTION 'E2E transient Knowledge yield failure'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${KNOWLEDGE_RETRY_TRIGGER} ON public."knowledge_yield_observations"`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${KNOWLEDGE_RETRY_TRIGGER} BEFORE INSERT OR UPDATE ON public."knowledge_yield_observations" FOR EACH ROW EXECUTE FUNCTION public.${KNOWLEDGE_RETRY_FUNCTION}()`);
  await prisma.$executeRawUnsafe(`DELETE FROM public.${KNOWLEDGE_RETRY_CONTROL_TABLE}`);
  await prisma.$executeRaw`INSERT INTO public.e2e_knowledge_retry_control ("companyId", "projectId") VALUES (${REVIEW_BRIDGE_COMPANY_ID!}, ${REVIEW_BRIDGE_PROJECT_ID!}) ON CONFLICT DO NOTHING`;
}

async function removeRetryFailureTrigger(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${KNOWLEDGE_RETRY_TRIGGER} ON public."knowledge_yield_observations"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.${KNOWLEDGE_RETRY_FUNCTION}()`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS public.${KNOWLEDGE_RETRY_CONTROL_TABLE}`);
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
    if (bridgeFixtureState() === "absent") {
      test.skip(true, "Configura todo el fixture E2E_REVIEW_BRIDGE_* para ejecutar el escenario bridge/retry contra PostgreSQL local.");
      return;
    }
    assertLocalBridgeEnvironment();
    const prisma = bridgePrisma();

    try {
      await assertFixtureRelationships(prisma);
      await installRetryFailureTrigger(prisma);
      await signIn(page);

      const findingsResponse = await page.request.get(`/api/review-runs/${REVIEW_BRIDGE_RUN_ID}/findings?page=1&pageSize=100`);
      expect(findingsResponse.status(), await findingsResponse.text()).toBe(200);
      const findings = await findingsResponse.json() as ReviewFindingResponse;
      const finding = findings.findings?.find((entry) => entry.id === REVIEW_BRIDGE_FINDING_ID);
      expect(finding).toMatchObject({
        id: REVIEW_BRIDGE_FINDING_ID,
        companyId: REVIEW_BRIDGE_COMPANY_ID,
        projectId: REVIEW_BRIDGE_PROJECT_ID,
        reviewRunId: REVIEW_BRIDGE_RUN_ID,
      });

      const decisionResponse = await page.request.post(`/api/review-findings/${REVIEW_BRIDGE_FINDING_ID}/decisions`, {
        headers: { "X-Correlation-Id": `e2e-bridge-retry:${REVIEW_BRIDGE_RUN_ID}:${REVIEW_BRIDGE_FINDING_ID}` },
        data: {
          resolution: "CONFIRMED_ISSUE",
          note: "E2E bridge/retry verification",
          expectedUpdatedAt: finding?.updatedAt,
        },
      });
      expect(decisionResponse.status(), await decisionResponse.text()).toBe(201);
      const decision = await decisionResponse.json() as { id: string; findingId: string };
      expect(decision.findingId).toBe(REVIEW_BRIDGE_FINDING_ID);

      const queueUrl = `/api/admin/knowledge/queue?companyId=${encodeURIComponent(REVIEW_BRIDGE_COMPANY_ID!)}&projectId=${encodeURIComponent(REVIEW_BRIDGE_PROJECT_ID!)}`;
      const jobKey = `review-learning:${decision.id}`;
      const currentJob = async (): Promise<NonNullable<KnowledgeQueueResponse["retryableJobs"]>[number] | undefined> => {
        const response = await page.request.get(queueUrl);
        if (!response.ok()) return undefined;
        const queue = await response.json() as KnowledgeQueueResponse;
        return queue.retryableJobs?.find((job) => job.idempotencyKey === jobKey);
      };

      await expect.poll(async () => (await currentJob())?.status, { timeout: 30_000 }).toBe("PENDING");
      expect(await currentJob()).toMatchObject({
        companyId: REVIEW_BRIDGE_COMPANY_ID,
        projectId: REVIEW_BRIDGE_PROJECT_ID,
        findingId: REVIEW_BRIDGE_FINDING_ID,
        decisionId: decision.id,
        idempotencyKey: jobKey,
      });

      // This is a real PostgreSQL trigger scoped to the isolated fixture. The
      // first worker execution must observe a transient write failure itself.
      await runKnowledgeWorker();
      await expect.poll(async () => (await currentJob())?.status, { timeout: 30_000 }).toBe("RETRYABLE_FAILED");
      const retryJob = await currentJob();
      expect(retryJob).toBeTruthy();

      await removeRetryFailureTrigger(prisma);
      const retryResponse = await page.request.post(`/api/admin/knowledge/jobs/${retryJob!.id}/retry`);
      expect(retryResponse.status(), await retryResponse.text()).toBe(200);
      await expect.poll(async () => (await currentJob())?.status, { timeout: 30_000 }).toBe("PENDING");

      await runKnowledgeWorker();
      await expect.poll(async () => (await currentJob())?.status, { timeout: 30_000 }).toBe("SUCCEEDED");

      const decisionYieldKey = `review-yield:${decision.id}`;
      const retryYieldCount = async (): Promise<number> => {
        const response = await page.request.get(`/api/knowledge/retrieval?q=${encodeURIComponent(REVIEW_BRIDGE_QUERY!)}&projectId=${encodeURIComponent(REVIEW_BRIDGE_PROJECT_ID!)}`);
        expect(response.status(), await response.text()).toBe(200);
        const retrieval = await response.json() as KnowledgeRetrievalResponse;
        return retrieval.yields?.filter((yieldObservation) => (
          yieldObservation.idempotencyKey === decisionYieldKey
          && yieldObservation.companyId === REVIEW_BRIDGE_COMPANY_ID
          && yieldObservation.projectId === REVIEW_BRIDGE_PROJECT_ID
        )).length ?? 0;
      };

      expect(await retryYieldCount()).toBe(1);
      await runKnowledgeWorker();
      expect(await retryYieldCount()).toBe(1);
    } finally {
      await removeRetryFailureTrigger(prisma).catch(() => undefined);
      await prisma.$disconnect();
    }
  });
});
