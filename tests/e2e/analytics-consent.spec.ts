import "dotenv/config";
import { test, expect } from "@playwright/test";

const BANNER_DIALOG = "Preferencias de analytics";
const BANNER_TEXT = "Ayúdanos a mejorar MC Presupuestos";
const CONSENT_COOKIE = "mc-analytics-consent";

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

  test("shows for a first-time visitor and hides after accepting", async ({ page }) => {
    await page.goto("/software-presupuestos-construccion");

    const banner = page.getByRole("dialog", { name: BANNER_DIALOG });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(BANNER_TEXT)).toBeVisible();

    await banner.getByRole("button", { name: "Aceptar analytics" }).click();
    await expect(banner).toBeHidden();

    const consentCookie = (await page.context().cookies()).find((cookie) => cookie.name === CONSENT_COOKIE);
    expect(consentCookie?.value).toBe("granted");
  });

  test("does not reappear or flash after a reload once consent is granted", async ({ page }) => {
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
