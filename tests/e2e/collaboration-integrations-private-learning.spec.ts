import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL ?? "e2e@mycpresupuestos.local";
const password = process.env.E2E_USER_PASSWORD ?? "E2eLocalTest123!";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contrase[ñn]a|password/i).fill(password);
  await page.getByRole("button", { name: /entrar|iniciar|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test.describe("collaboration, controlled integrations and private learning", () => {
  test("exposes the three guarded workflows through a real authenticated fixture", async ({ page }) => {
    test.skip(!process.env.E2E_COLLABORATION_BUDGET_ID, "Requires a synthetic authenticated budget fixture");
    await signIn(page);
    const budgetId = process.env.E2E_COLLABORATION_BUDGET_ID as string;
    const comments = await page.request.get(`/api/budgets/${budgetId}/collaboration/comments?entityType=BUDGET&entityId=${budgetId}`);
    expect(comments.status()).toBe(200);
    const suggestions = await page.request.get(`/api/budgets/${budgetId}/private-learning/suggestions?signalType=EXPLICIT_CORRECTION`);
    expect(suggestions.status()).toBe(200);
    const invalid = await page.request.post(`/api/budgets/${budgetId}/integrations/sessions`, { data: { adapter: "xlsx-csv", payload: "not-json", requestId: `e2e-invalid-${Date.now()}` } });
    expect([400, 403]).toContain(invalid.status());
  });

  test("keeps the foreign tenant invisible with an authenticated session", async ({ page }) => {
    test.skip(!process.env.E2E_COLLABORATION_BUDGET_ID, "Requires a synthetic authenticated budget fixture");
    await signIn(page);
    const response = await page.request.get(`/api/budgets/${process.env.E2E_FOREIGN_BUDGET_ID ?? "foreign-budget"}/private-learning/suggestions`);
    expect([403, 404]).toContain(response.status());
  });

  test("runs comment reply and optimistic-conflict API flow with the fixture budget", async ({ page }) => {
    test.skip(!process.env.E2E_COLLABORATION_BUDGET_ID, "Requires a synthetic authenticated budget fixture");
    await signIn(page);
    const budgetId = process.env.E2E_COLLABORATION_BUDGET_ID as string;
    const created = await page.request.post(`/api/budgets/${budgetId}/collaboration/comments`, { data: { entityType: "BUDGET", entityId: budgetId, body: `E2E root ${Date.now()}` } });
    expect(created.status()).toBe(201);
    const root = await created.json() as { comment?: { id: string; updatedAt: string } };
    expect(root.comment?.id).toBeTruthy();
    const reply = await page.request.post(`/api/budgets/${budgetId}/collaboration/comments`, { data: { entityType: "BUDGET", entityId: budgetId, parentCommentId: root.comment?.id, body: "E2E reply" } });
    expect(reply.status()).toBe(201);
    const stale = await page.request.patch(`/api/budgets/${budgetId}/collaboration/comments/${root.comment?.id}`, { data: { resolved: true, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" } });
    expect(stale.status()).toBe(409);
  });

  test("runs staged preview, explicit confirmation and rollback against a real budget item", async ({ page }) => {
    test.skip(!process.env.E2E_COLLABORATION_BUDGET_ID, "Requires a synthetic authenticated budget fixture");
    await signIn(page);
    const budgetId = process.env.E2E_COLLABORATION_BUDGET_ID as string;
    const requestId = `e2e-session-${Date.now()}`;
    const itemId = process.env.E2E_COLLABORATION_BUDGET_ITEM_ID;
    expect(itemId).toBeTruthy();
    const created = await page.request.post(`/api/budgets/${budgetId}/integrations/sessions`, { data: { adapter: "xlsx-csv", contractVersion: "1", payload: JSON.stringify({ updates: [{ id: itemId, description: "Ítem E2E actualizado", quantity: "2", unitPrice: "12.50" }] }), requestId } });
    expect(created.status()).toBe(201);
    const createdBody = await created.json() as { session: { id: string } };
    const sessionId = createdBody.session.id;
    expect((await page.request.post(`/api/budgets/${budgetId}/integrations/sessions/${sessionId}/validate`)).status()).toBe(200);
    const previewResponse = await page.request.get(`/api/budgets/${budgetId}/integrations/sessions/${sessionId}/preview`);
    expect(previewResponse.status()).toBe(200);
    const preview = await previewResponse.json() as { status: string; confirmationToken: string; expectedVersion: number };
    expect(preview.status).toBe("PREVIEW_READY");
    const applied = await page.request.post(`/api/budgets/${budgetId}/integrations/sessions/${sessionId}/confirm`, { data: { confirmationToken: preview.confirmationToken, expectedVersion: preview.expectedVersion, requestId: `${requestId}:apply` } });
    expect(applied.status(), await applied.text()).toBe(200);
    expect((await page.request.post(`/api/budgets/${budgetId}/integrations/sessions/${sessionId}/rollback`, { data: { requestId: `${requestId}:rollback` } })).status()).toBe(200);
  });

  test("opens and closes the authenticated SSE stream without reconnecting after abort", async ({ page }) => {
    test.skip(!process.env.E2E_COLLABORATION_BUDGET_ID, "Requires a real authenticated budget fixture");
    await signIn(page);
    const budgetId = process.env.E2E_COLLABORATION_BUDGET_ID as string;
    const result = await page.evaluate(async (id) => {
      const controller = new AbortController();
      const response = await fetch(`/api/budgets/${id}/collaboration/stream`, { headers: { Accept: "text/event-stream" }, signal: controller.signal });
      const reader = response.body?.getReader();
      const first = await reader?.read();
      controller.abort();
      return { status: response.status, hasPreamble: Boolean(first?.value && first.value.length > 0) };
    }, budgetId);
    expect(result).toEqual({ status: 200, hasPreamble: true });
  });
});
