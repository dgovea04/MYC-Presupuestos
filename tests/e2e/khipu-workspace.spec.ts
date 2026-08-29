import { test, expect, type Page } from "@playwright/test";

const USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /iniciar sesi[oó]n/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/correo|email/i).fill(USER_EMAIL);
  await page.getByLabel(/contrase[ñn]a|password/i).fill(USER_PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test.describe("Khipu workspace @smoke", () => {
  test.skip(!process.env.E2E_KHIPU_PATH, "E2E_KHIPU_PATH is not configured");

  test("renders the assistant controls and remains usable on mobile", async ({ page }) => {
    await signIn(page);
    await page.goto(process.env.E2E_KHIPU_PATH ?? "/khipu");
    await expect(page.getByRole("region", { name: "Khipu" })).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole("button", { name: "Mostrar Asistente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mostrar Métricas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chat técnico" }).first()).toBeVisible();
    await expect(page.getByText("Trabajo activo")).toBeVisible();

    await page.getByRole("button", { name: "Mostrar Métricas" }).click();
    await expect(page.getByText("Calidad de Khipu")).toBeVisible({ timeout: 15_000 });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Mostrar Asistente" }).click();
    await expect(page.getByRole("region", { name: "Khipu" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
  });
});
