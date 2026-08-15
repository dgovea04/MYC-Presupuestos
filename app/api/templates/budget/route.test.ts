import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUserBudgetTemplateFromBudget: vi.fn(),
  getAuthSession: vi.fn(),
  listUserBudgetTemplates: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/budget-templates", () => ({
  createUserBudgetTemplateFromBudget: mocks.createUserBudgetTemplateFromBudget,
  listUserBudgetTemplates: mocks.listUserBudgetTemplates,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

vi.mock("@/lib/billing/route-access", () => ({
  getFeatureAccessResponse: vi.fn().mockResolvedValue(null),
}));

import { GET, POST } from "@/app/api/templates/budget/route";

describe("/api/templates/budget", () => {
  beforeEach(() => {
    mocks.createUserBudgetTemplateFromBudget.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.listUserBudgetTemplates.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("returns 401 when listing without a session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("lists user budget templates", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.listUserBudgetTemplates.mockResolvedValue([{ id: "template-1", name: "Arquitectura base" }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: "template-1", name: "Arquitectura base" }]);
    expect(mocks.listUserBudgetTemplates).toHaveBeenCalledWith("user-1");
  });

  it("creates a user budget template from a source budget", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createUserBudgetTemplateFromBudget.mockResolvedValue({ id: "template-1", name: "Arquitectura base" });

    const response = await POST(
      new Request("http://localhost/api/templates/budget", {
        method: "POST",
        body: JSON.stringify({
          budgetId: "budget-1",
          name: "Arquitectura base",
          description: "Base validada.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "template-1", name: "Arquitectura base" });
    expect(mocks.createUserBudgetTemplateFromBudget).toHaveBeenCalledWith("user-1", {
      budgetId: "budget-1",
      name: "Arquitectura base",
      description: "Base validada.",
    });
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "BUDGET_CREATED",
      title: "Plantilla creada",
      detail: "Arquitectura base",
      href: "/templates/budget/template-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps a successful template creation when activity logging fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createUserBudgetTemplateFromBudget.mockResolvedValue({ id: "template-1", name: "Arquitectura base" });
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await POST(
      new Request("http://localhost/api/templates/budget", {
        method: "POST",
        body: JSON.stringify({
          budgetId: "budget-1",
          name: "Arquitectura base",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "template-1", name: "Arquitectura base" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects invalid creation payloads", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/templates/budget", {
        method: "POST",
        body: JSON.stringify({ name: "Sin presupuesto" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "budgetId es obligatorio" });
    expect(mocks.createUserBudgetTemplateFromBudget).not.toHaveBeenCalled();
    expect(mocks.recordActivityEvent).not.toHaveBeenCalled();
  });
});
