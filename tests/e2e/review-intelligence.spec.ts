import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";
const REVIEW_BUDGET_PATH = process.env.E2E_REVIEW_BUDGET_PATH;
const REVIEW_XLSX_FIXTURE = process.env.E2E_REVIEW_XLSX_FIXTURE;

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
      const url = request.url();
      if (request.method() !== "GET" && /\/api\/budgets\/[^/]+(?:\?|$)/.test(url)) {
        budgetWriteRequests.push({ method: request.method(), url });
      }
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
          coverageByCategory: { quantity: 12, specification: 7, apuComponent: 4, yield: 3 },
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
