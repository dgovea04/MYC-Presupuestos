import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";

const BANNER_DIALOG = "Preferencias de analytics";
const BANNER_TEXT = "Ayúdanos a mejorar MC Presupuestos";
const CONSENT_COOKIE = "mc-analytics-consent";
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";

async function signInWithCredentials(page: Page): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /iniciar sesi[oó]n/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/correo|email/i).fill(E2E_USER_EMAIL);
  await page.getByLabel(/contrase[ñn]a|password/i).fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test.describe("analytics consent banner", () => {
  test.skip(
    !process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    "NEXT_PUBLIC_GA_MEASUREMENT_ID is not configured",
  );

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/analytics/events", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**://www.googletagmanager.com/**", async (route) => {
      await route.abort();
    });
  });

  test("does not show for an anonymous first-time visitor", async ({ page }) => {
    await page.goto("/software-presupuestos-construccion");

    await expect(page.getByRole("dialog", { name: BANNER_DIALOG })).toBeHidden();
    await expect(page.getByText(BANNER_TEXT)).toHaveCount(0);
  });

  test("shows for an authenticated first-time visitor and does not flash after consent", async ({ page }) => {
    await signInWithCredentials(page);
    await page.goto("/software-presupuestos-construccion");

    const banner = page.getByRole("dialog", { name: BANNER_DIALOG });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Aceptar analytics" }).click();
    await expect(banner).toBeHidden();

    await page.reload();

    // Poll for ~1s to catch any transient flash during hydration.
    let everVisible = false;
    for (let i = 0; i < 20; i += 1) {
      if (await banner.isVisible().catch(() => false)) {
        everVisible = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(everVisible).toBe(false);
    await expect(banner).toBeHidden();
  });

  test("never ships the banner in server-rendered HTML", async ({ page }) => {
    const response = await page.goto("/software-presupuestos-construccion");
    const html = await response!.text();
    expect(html).not.toContain(BANNER_TEXT);
  });
});
