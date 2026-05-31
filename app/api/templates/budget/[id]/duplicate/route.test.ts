import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  duplicateUserBudgetTemplate: vi.fn(),
  getAuthSession: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/budget-templates", () => ({
  duplicateUserBudgetTemplate: mocks.duplicateUserBudgetTemplate,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

import { POST } from "@/app/api/templates/budget/[id]/duplicate/route";

describe("POST /api/templates/budget/[id]/duplicate", () => {
  beforeEach(() => {
    mocks.duplicateUserBudgetTemplate.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("duplicates a template owned by the current user", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.duplicateUserBudgetTemplate.mockResolvedValue({ id: "template-copy", name: "Arquitectura copia" });

    const response = await POST(
      new Request("http://localhost/api/templates/budget/template-1/duplicate", {
        method: "POST",
        body: JSON.stringify({ name: "Arquitectura copia", description: "Duplicado operativo" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "template-copy", name: "Arquitectura copia" });
    expect(mocks.duplicateUserBudgetTemplate).toHaveBeenCalledWith("template-1", "user-1", {
      name: "Arquitectura copia",
      description: "Duplicado operativo",
    });
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "BUDGET_UPDATED",
      title: "Plantilla duplicada",
      detail: "Arquitectura copia",
      href: "/templates/budget/template-copy",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates/budget/template-copy");
  });

  it("keeps a successful template duplication when activity logging fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.duplicateUserBudgetTemplate.mockResolvedValue({ id: "template-copy", name: "Arquitectura copia" });
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await POST(
      new Request("http://localhost/api/templates/budget/template-1/duplicate", {
        method: "POST",
        body: JSON.stringify({ name: "Arquitectura copia" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "template-copy", name: "Arquitectura copia" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates/budget/template-copy");
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/templates/budget/template-1/duplicate"), {
      params: Promise.resolve({ id: "template-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.duplicateUserBudgetTemplate).not.toHaveBeenCalled();
    expect(mocks.recordActivityEvent).not.toHaveBeenCalled();
  });
});
