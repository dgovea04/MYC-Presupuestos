import { test, expect } from "@playwright/test";

test.describe("construction budgeting acquisition landing", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/analytics/events", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
  });

  test("renders the free registration journey and core construction workflow", async ({ page }) => {
    await page.goto("/software-presupuestos-construccion");

    await expect(page.getByRole("heading", { level: 1, name: /crea tu primer presupuesto de obra gratis/i })).toBeVisible();
    await expect(page.getByRole("img", { name: "MC Presupuestos" }).first()).toHaveAttribute("src", /nuevo-logo-300-v3/);
    await expect(page.getByRole("link", { name: "Crear mi primer presupuesto gratis" }).first()).toHaveAttribute("href", "/register");
    await expect(page.getByText(/presupuesto.*metrados.*apu.*fórmula polinómica.*cronograma/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /todo lo necesario para comenzar a presupuestar/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /cada costo unitario conserva su contexto técnico/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /la cantidad deja de ser un número suelto/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /reajustes con una base técnica que se puede explicar/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /organiza tu obra de principio a fin/i })).toBeVisible();
    await expect(page.getByText(/K = 0\.250Jr\/Jo \+ 0\.300Mr\/Mo \+ 0\.150Er\/Eo \+ 0\.200Gg\/Go \+ 0\.200Cq\/Cq/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Usuarios Fundadores Perú" })).toHaveCount(0);
    await expect(page.getByText(/cuando necesites más automatización.*podrás ampliar tu plan/i)).toBeVisible();
    await expect(page.getByText("https://www.youtube.com/watch?v=VIDEO_ID").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /abrir placeholder de demo/i })).toHaveAttribute("href", "https://www.youtube.com/watch?v=VIDEO_ID");
  });

  test("takes a visitor to the existing Starter registration route", async ({ page }) => {
    await page.goto("/software-presupuestos-construccion");
    await page.getByRole("link", { name: "Crear mi primer presupuesto gratis" }).first().click();
    await page.waitForURL(/\/register$/);
    await expect(page.getByRole("heading", { name: /crear cuenta/i })).toBeVisible();
  });

  test("submits the two-field pilot form while preserving acquisition metadata", async ({ page }) => {
    let submittedBody: Record<string, unknown> | null = null;
    await page.route("**/api/beta/applications", async (route) => {
      submittedBody = JSON.parse(route.request().postData() ?? "null") as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, applicationId: "application-e2e" }) });
    });
    await page.goto("/software-presupuestos-construccion?utm_source=playwright&utm_campaign=qa");
    await page.getByRole("link", { name: "Conocer opción para equipos" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Nombre").last().fill("Usuario QA");
    await page.getByLabel("Email").last().fill("qa@example.com");
    await page.getByRole("button", { name: "Cuéntanos sobre tu equipo" }).last().click();
    await expect(page.getByText(/recibimos tu solicitud/i)).toBeVisible();
    expect(submittedBody).toMatchObject({ name: "Usuario QA", email: "qa@example.com" });
    expect(submittedBody?.metadata).toEqual(expect.objectContaining({ landing_path: "/software-presupuestos-construccion", landing_variant: "acquisition-v1", cta_location: "acquisition_pilot_form" }));
  });

  test("keeps the acquisition navigation usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/software-presupuestos-construccion");

    const openNavigation = page.getByRole("button", { name: "Abrir navegación" });
    await expect(openNavigation).toBeVisible();
    await openNavigation.click();
    await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear cuenta gratis" }).last()).toBeVisible();
  });
});
