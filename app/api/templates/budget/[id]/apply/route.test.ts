import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyUserBudgetTemplateToProject: vi.fn(),
  getAuthSession: vi.fn(),
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

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

vi.mock("@/lib/data/budget-templates", () => ({
  applyUserBudgetTemplateToProject: mocks.applyUserBudgetTemplateToProject,
}));

import { POST } from "@/app/api/templates/budget/[id]/apply/route";

describe("POST /api/templates/budget/[id]/apply", () => {
  beforeEach(() => {
    mocks.applyUserBudgetTemplateToProject.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it("applies a template and returns the created budget", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.applyUserBudgetTemplateToProject.mockResolvedValue({
      id: "budget-created",
      projectId: "project-1",
      name: "Arquitectura aplicada",
      templateName: "Arquitectura reusable",
    });

    const response = await POST(
      new Request("http://localhost/api/templates/budget/template-1/apply", {
        method: "POST",
        body: JSON.stringify({ projectId: "project-1", name: "Arquitectura aplicada" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "budget-created",
      projectId: "project-1",
      name: "Arquitectura aplicada",
      templateName: "Arquitectura reusable",
    });
    expect(mocks.applyUserBudgetTemplateToProject).toHaveBeenCalledWith("template-1", "user-1", {
      projectId: "project-1",
      name: "Arquitectura aplicada",
    });
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "BUDGET_CREATED",
      title: "Presupuesto creado desde plantilla",
      detail: "Arquitectura aplicada desde Arquitectura reusable",
      href: "/budgets/budget-created",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("dashboard-stats", "max");
  });

  it("keeps a successful template application when activity logging fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.applyUserBudgetTemplateToProject.mockResolvedValue({
      id: "budget-created",
      projectId: "project-1",
      name: "Arquitectura aplicada",
      templateName: "Arquitectura reusable",
    });
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await POST(
      new Request("http://localhost/api/templates/budget/template-1/apply", {
        method: "POST",
        body: JSON.stringify({ projectId: "project-1", name: "Arquitectura aplicada" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "budget-created",
      projectId: "project-1",
      name: "Arquitectura aplicada",
      templateName: "Arquitectura reusable",
    });
  });

  it("rejects invalid payloads", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/templates/budget/template-1/apply", {
        method: "POST",
        body: JSON.stringify({ name: "Sin proyecto" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "projectId es obligatorio" });
    expect(mocks.applyUserBudgetTemplateToProject).not.toHaveBeenCalled();
  });
});
