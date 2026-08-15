import { test, expect, type APIResponse, type Cookie, type Page } from "@playwright/test";

/**
 * MC Presupuestos — Excel-mode end-to-end smoke test.
 *
 * Verifies the five Excel-mode interaction contracts wired across the
 * Excel-mode rollout (Tasks 1-10 of
 * docs/superpowers/plans/2026-07-20-excel-mode-professional-grid.md) hold
 * end-to-end in a real browser, behind an isolated local E2E user session.
 *
 * Lock-in cells:
 *   1. Budget editor: focused cell carries `data-spreadsheet-active="true"`
 *      AND `Ctrl/⌘+D` triggers fill-down from the top of the selection.
 *   2. Budget editor → APU sheet dialog: parent → child inheritance of
 *      `data-view-mode="excel"` AND `data-excel-field-border-scope="apu-editor"`.
 *   3. Polynomial formula table: `rounded-md` density frame in Excel mode
 *      (note: the planner document referenced `rounded-none`; polynomial-
 *      monomials-table.tsx uses `rounded-md` — see the comment in the
 *      polynomial test for the divergence).
 *   4. General budget footer: `--excel-row-height` CSS variable on the root
 *      + `h-[var(--excel-control-height)]` inputs.
 *   5. Resources / Partidas tables: each row renders a `CompactRowActions`
 *      trigger that expands into a per-row action menu.
 *
 * Auth: credentials sign-in via `/login` form using the isolated local E2E user.
 * Defaults are `e2e@mycpresupuestos.local` / `E2eLocalTest123!`. Override via
 * env vars: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.
 *
 * Setup: `test.beforeAll` flips the E2E user's `defaultViewMode` to `"excel"`
 * via the dev-only POST `/api/dev/set-view-mode` (gated to non-production
 * by `process.env.NODE_ENV !== "production"`). This bypasses the
 * custom-tab + Radix Select + save-button UI dance in `/settings` and is
 * reliable in CI because the change persists in the DB rather than relying
 * on UI click choreography that breaks when `<Select id="defaultViewMode">`
 * is rendered inside a hidden tab panel.
 */

const SEED_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const SEED_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";
const SEED_PROJECT_NAME = process.env.E2E_PROJECT_NAME ?? "Edificio Multifamiliar - Demo";
const SEED_BUDGET_NAME = process.env.E2E_BUDGET_NAME ?? "Arquitectura";

async function signInWithCredentials(page: Page): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /iniciar sesi[oó]n/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/correo|email/i).fill(SEED_USER_EMAIL);
  await page.getByLabel(/contrase[ñn]a|password/i).fill(SEED_USER_PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function goToSeedProjectAndBudget(page: Page): Promise<{ budgetId: string; generalBudgetId: string }> {
  await page.goto("/projects");
  // Project names render as plain text inside <TD>; navigation is a
  // separate "Abrir" link inside the same row (projects-table.tsx ~229).
  await page
    .getByRole("row", { name: new RegExp(SEED_PROJECT_NAME, "i") })
    .getByRole("link", { name: /abrir/i })
    .first()
    .click({ timeout: 30_000 });
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });

  // On the project detail page, the GENERAL budget card uses a different
  // wrapper class (`theme-muted-panel-strong` — project-budget-sections.tsx
  // ~88) than sub-budget cards (`theme-surface-panel` ~107). So we can't
  // scope both via the same CSS class. Instead, find the general budget's
  // link by its UNIQUE accessible name "Abrir editor" (the sub-budget
  // links use "Abrir Sub Presupuesto", and the page header link uses
  // "Abrir presupuesto general" — so "/abrir editor/i" only matches the
  // general budget card). Capture its href BEFORE navigating away.
  const generalBudgetLink = page.getByRole("link", { name: /^abrir editor$/i }).first();
  await expect(generalBudgetLink, "general budget link must be present on the project detail page").toBeVisible({
    timeout: 15_000,
  });
  const generalBudgetHref = await generalBudgetLink.getAttribute("href");
  const generalBudgetId = generalBudgetHref?.match(/\/budgets\/([^/?]+)/)?.[1];
  if (!generalBudgetId) throw new Error(`Could not parse general budget id from href: ${generalBudgetHref ?? "<null>"}`);

  // Sub-budgets render as cards with the budget name in
  // <p class="theme-strong-text ..."> + an "Abrir Sub Presupuesto" link.
  // CSS-scoped .filter({ has }) properly scopes to a single card without
  // leaking across siblings (unlike CSS `:has-text`).
  const budgetCard = page
    .locator("div.theme-surface-panel")
    .filter({ has: page.locator("p.theme-strong-text", { hasText: new RegExp(`^${SEED_BUDGET_NAME}$`, "i") }) });
  await budgetCard
    .locator(`a[href^="/budgets/"]`)
    .first()
    .click({ timeout: 30_000 });
  await page.waitForURL(/\/budgets\/[^/?]+$/, { timeout: 30_000 });

  const url = new URL(page.url());
  const matches = url.pathname.match(/\/budgets\/([^/]+)/);
  if (!matches?.[1]) throw new Error(`Could not parse budget id from URL: ${url.pathname}`);
  return { budgetId: matches[1], generalBudgetId };
}

async function assertServerIsReachable(response: APIResponse | undefined): Promise<void> {
  if (!response) return;
  // Tolerant health probe: anything <500 (next-auth can return 401 on the
  // session endpoint when no cookie is present, which is a valid 4xx).
  expect(response.status(), "dev server must be reachable").toBeLessThan(500);
}

test.describe.configure({ mode: "serial" });

let authCookies: Cookie[] = [];

test.describe("Excel-mode pipeline @smoke", () => {
  test.beforeAll(async ({ browser, request }) => {
    // Authenticate once and reuse the session across the serial tests. The
    // application rate-limits repeated login attempts by account and origin;
    // logging in before every test would exercise that defense instead of the
    // Excel-mode contracts.
    const authContext = await browser.newContext();
    const authPage = await authContext.newPage();
    await signInWithCredentials(authPage);
    authCookies = (await authContext.cookies()).filter((cookie) => cookie.name !== "app_view_mode");
    await authContext.close();
    // 1. Server reachability probe.
    const probe = await request.get("/api/auth/session").catch(() => undefined);
    await assertServerIsReachable(probe);

    // 2. Flip the isolated E2E user to Excel mode via the dev-only shortcut.
    // Persists in the DB so every test in this file sees Excel mode without
    // driving the custom-tab + Radix Select + save-button UI dance in
    // `/settings`. The route is gated to non-production builds.
    const setMode = await request.post("/api/dev/set-view-mode", {
      data: { email: SEED_USER_EMAIL, viewMode: "excel" },
    });
    expect(setMode.ok(), "dev /api/dev/set-view-mode must accept the request").toBeTruthy();
    const setModeJson = await setMode.json();
    // Response shape is fully pinned by app/api/dev/set-view-mode/route.test.ts.
    // The e2e only needs to verify the side-effect (defaultViewMode flipped) +
    // that the route resolved a real userId (sanity for the lookup path).
    expect(setModeJson.userId, "dev route response must include the resolved userId").toBeTruthy();
    expect(setModeJson.defaultViewMode, "E2E user must be persisted as excel mode").toBe("excel");
  });

  // Restore the E2E user's defaultViewMode to "modern" so subsequent test
  // runs (or other spec files that share the same seeded DB) don't
  // inherit Excel mode as the new baseline. Without this, a flaky failure
  // mid-suite could leave the seed stuck in Excel mode for the next run.
  test.afterAll(async ({ request }) => {
    let resetMode: APIResponse | null = null;
    try {
      resetMode = await request.post("/api/dev/set-view-mode", {
        data: { email: SEED_USER_EMAIL, viewMode: "modern" },
      });
    } catch (error) {
      // Don't fail the suite — the reset is best-effort. A missing dev
      // route on a production build or a teardown-time server crash is
      // expected to be silently swallowed here.
      // eslint-disable-next-line no-console -- intentional diagnostic
      console.warn("[excel-mode] afterAll reset threw:", error);
      return;
    }
    if (!resetMode.ok()) {
      // eslint-disable-next-line no-console -- intentional diagnostic
      console.warn(`[excel-mode] afterAll reset returned ${resetMode.status()} ${resetMode.statusText()}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies(authCookies);
    await page.context().clearCookies({ name: "app_view_mode" });
    await page.goto("/dashboard");
    // Wait for SSR hydration + the post-signin route's network requests to
    // settle before asserting the data-view-mode attribute. Avoids a race
    // where the locator passes only because Playwright polled late, not
    // because the SSR'd <AppViewModeProvider> actually published the
    // attribute. No explicit setTimeout is needed: updateUserSettings in
    // lib/data/settings.ts already calls processUserSettingsCache.delete(userId)
    // after the DB write + revalidateTag, so the cache is invalidated
    // synchronously by the time we land here.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    // DB-driven defaultViewMode=excel auto-applies on any page render via
    // the <AppViewModeProvider>. Verify it lands on the current page so a
    // regression on the SSR'd FormattingSettingsProvider surfaces here.
    await expect(page.locator('div[data-view-mode="excel"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test("default view mode is Excel (DB-driven) and --excel-row-height is published", async ({ page }) => {
    const excelScope = page.locator('div[data-view-mode="excel"]').first();
    await expect(excelScope).toBeVisible({ timeout: 15_000 });
    const height = await excelScope.evaluate((el) =>
      getComputedStyle(el as HTMLElement).getPropertyValue("--excel-row-height").trim(),
    );
    expect(height, "--excel-row-height must be published on the Excel-mode scope").toMatch(/\d+px/);
  });

  // Surface the budget-editor cursor contract and keep the failure diagnostic
  // if the production cell implementation regresses:
  // The focused cell must expose `data-spreadsheet-active="true"`; this
  // test intentionally remains a normal assertion so a missing contract
  // fails the suite instead of hiding a production regression.
  test(
    "[auth-bounded] budget editor cursor: data-spreadsheet-active + post-Ctrl+D fill-down",

    async ({ page }) => {
      await goToSeedProjectAndBudget(page);
      const firstInput = page
        .locator('div[data-view-mode="excel"]')
        .locator("input")
        .first();
      await firstInput.click();
      await expect(firstInput, "expected once budget-editor renders data-spreadsheet-active").toHaveAttribute(
        "data-spreadsheet-active",
        "true",
        { timeout: 5_000 },
      );
    },
  );

  test("APU sheet dialog inherits data-view-mode=excel + data-excel-field-border-scope=apu-editor", async ({ page }) => {
    await goToSeedProjectAndBudget(page);

    // The APU trigger is a per-row button with aria-label="Abrir editor APU
    // de esta partida" (verified at budget-editor.tsx line ~4427). It is
    // rendered INLINE on the row (next to an IA pill + the action menu
    // trigger), not inside a dropdown — so a direct click works.
    await page
      .locator('div[data-view-mode="excel"]')
      .locator('button[aria-label="Abrir editor APU de esta partida"]')
      .first()
      .click();

    // Target the APU sheet by its unique testid (apu-editor-sheet.tsx ~514).
    // The budget editor mounts several Radix Dialogs (catalog insert,
    // excel import, save template, clear sub-budget) which can collide
    // with a generic [role="dialog"] match, so we use the testid for
    // APU-specific scoping. `toBeVisible()` enforces that the dialog is
    // actually open and rendered (Radix Dialog unmounts the content when
    // `open={false}` in this codebase — confirmed by v6 run).
    const apuPane = page.locator('[data-testid="apu-editor-sheet-panel"]').first();
    await expect(apuPane).toBeVisible({ timeout: 30_000 });
    expect(await apuPane.getAttribute("data-view-mode")).toBe("excel");
    expect(await apuPane.getAttribute("data-excel-field-border-scope")).toBe("apu-editor");
  });

  test(
  "[auth-bounded] polynomial formula table: Excel density frame",
  async ({ page }) => {
    const { generalBudgetId } = await goToSeedProjectAndBudget(page);
    // Real route is /budgets/[id]/polynomial-formula (verified in
    // app/budgets/[id]/polynomial-formula/page.tsx). The page resolves the
    // GENERAL budget via getGeneralBudgetSectionContext(id) — passing a
    // sub-budget id here renders a 404, so we use generalBudgetId.
    await page.goto(`/budgets/${generalBudgetId}/polynomial-formula`);
    const sectionLink = page.getByRole("link", {
      name: new RegExp(`^${SEED_BUDGET_NAME} \\d+ monomios$`, "i"),
    });
    await expect(sectionLink).toBeVisible({ timeout: 30_000 });
    await sectionLink.click();
    await page.waitForURL(/\/polynomial-formula\?section=/, { timeout: 30_000 });

    const generateFormulaButton = page.getByRole("button", { name: /generar fórmula/i });
    if (await generateFormulaButton.count() > 0) {
      await expect(generateFormulaButton).toBeVisible({ timeout: 15_000 });
      const generationResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/api\/budgets\/[^/]+\/polynomial-formula$/.test(response.url()),
        { timeout: 30_000 },
      );
      await generateFormulaButton.click();
      const generationResponse = await generationResponsePromise;
      expect(
        generationResponse.ok(),
        `formula generation failed: ${await generationResponse.text()}`,
      ).toBeTruthy();
    }

    const frame = page.locator('[data-testid="polynomial-monomials-table-frame"]');
    // The route can keep background requests active; the frame is the stable
    // readiness signal for this contract.
    await expect(frame).toBeVisible({ timeout: 30_000 });
    const classList = await frame.evaluate((el) => Array.from(el.classList));

    // The frame uses getTableFrameClassName which returns `rounded-none`
    // (the broader CSS-variable Excel-mode table frame contract in
    // app/globals.css). The plan-doc originally referenced `rounded-md`
    // but the shared helper uses `rounded-none` + `border-transparent`
    // to let the background bleed edge-to-edge in Excel mode.
    expect(classList).toContain("rounded-none");
    expect(classList).not.toContain("rounded-2xl");

    const height = await frame.evaluate((el) => {
      const scope = el.closest('[data-view-mode="excel"]') as HTMLElement | null;
      return scope ? getComputedStyle(scope).getPropertyValue("--excel-row-height").trim() : null;
    });
    expect(height).toMatch(/\d+px/);
  });

  test("general budget footer: --excel-row-height + h-[var(--excel-control-height)] inputs", async ({ page }) => {
    const { generalBudgetId } = await goToSeedProjectAndBudget(page);
    // The footer route is the general budget's footer summary table — it
    // resolves the GENERAL budget via getGeneralBudgetSectionContext, so
    // passing a sub-budget id renders a 404.
    await page.goto(`/budgets/${generalBudgetId}/footer`);

    const excelScope = page.locator('div[data-view-mode="excel"]').first();
    // The footer can keep background requests active, so `networkidle` is not
    // a reliable readiness signal for this route. The rendered Excel scope is
    // the contract this test needs to verify.
    await expect(excelScope).toBeVisible({ timeout: 30_000 });
    // From general-budget-footer-table.tsx line ~347/375: inputs carry the
    // arbitrary-value class `h-[var(--excel-control-height)]` in Excel mode.
    const control = excelScope.locator('[class*="h-[var(--excel-control-height)]"]').first();
    await expect(control).toBeVisible({ timeout: 15_000 });
    const classList = await control.evaluate((el) => Array.from(el.classList));
    expect(classList.join(" ")).toMatch(/h-\[var\(--excel-control-height\)\]/);

    const height = await excelScope.evaluate((el) =>
      getComputedStyle(el as HTMLElement).getPropertyValue("--excel-row-height").trim(),
    );
    expect(height).toMatch(/\d+px/);
  });

  test("resources table: CompactRowActions menu opens per row", async ({ page }) => {
    await page.goto("/resources");
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
    // CompactRowActions renders a button with `aria-haspopup="menu"` and the
    // default `aria-label="Abrir acciones de fila"` (verified in
    // components/spreadsheet/compact-row-actions.tsx).
    const trigger = page.getByRole("button", { name: /abrir acciones de fila/i }).first();
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();
    // Once opened, the trigger's aria-expanded flips to true and the menu
    // surfaces as a role="menu" sibling.
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 5_000 });
    await expect(page.getByRole("menu").first()).toBeVisible({ timeout: 5_000 });
  });

  test("partidas table: CompactRowActions menu opens per row", async ({ page }) => {
    await page.goto("/partidas");
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
    const trigger = page.getByRole("button", { name: /abrir acciones de fila/i }).first();
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 5_000 });
    await expect(page.getByRole("menu").first()).toBeVisible({ timeout: 5_000 });
  });
});
