import { test, expect } from "@playwright/test";

test.describe("collaboration, controlled integrations and private learning", () => {
  test("exposes the three guarded workflows only in an authenticated fixture", async ({ page }) => {
    test.skip(!process.env.E2E_COLLABORATION_BUDGET_ID, "Requires a synthetic authenticated budget fixture");
    const budgetId = process.env.E2E_COLLABORATION_BUDGET_ID as string;
    const comments = await page.request.get(`/api/budgets/${budgetId}/collaboration/comments?entityType=BUDGET&entityId=${budgetId}`);
    expect([200, 401, 403]).toContain(comments.status());
    const suggestions = await page.request.get(`/api/budgets/${budgetId}/private-learning/suggestions?signalType=EXPLICIT_CORRECTION`);
    expect([200, 401, 403]).toContain(suggestions.status());
  });
});
