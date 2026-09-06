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

  test("does not expose review documents across workspace boundaries", async ({ page }) => {
    await signIn(page);
    const response = await page.request.get("/api/projects/foreign-project/review-documents");
    expect([403, 404]).toContain(response.status());
  });
});
