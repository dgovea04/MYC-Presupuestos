import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteUserBudgetTemplate: vi.fn(),
  getAuthSession: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateUserBudgetTemplate: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/budget-templates", () => ({
  deleteUserBudgetTemplate: mocks.deleteUserBudgetTemplate,
  updateUserBudgetTemplate: mocks.updateUserBudgetTemplate,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

import { DELETE, PATCH } from "@/app/api/templates/budget/[id]/route";

describe("/api/templates/budget/[id]", () => {
  beforeEach(() => {
    mocks.deleteUserBudgetTemplate.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.updateUserBudgetTemplate.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it("updates a template owned by the current user", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.updateUserBudgetTemplate.mockResolvedValue({ id: "template-1", name: "Arquitectura costa" });

    const response = await PATCH(
      new Request("http://localhost/api/templates/budget/template-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Arquitectura costa", description: "Base ajustada" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "template-1", name: "Arquitectura costa" });
    expect(mocks.updateUserBudgetTemplate).toHaveBeenCalledWith("template-1", "user-1", {
      name: "Arquitectura costa",
      description: "Base ajustada",
    });
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "BUDGET_UPDATED",
      title: "Plantilla actualizada",
      detail: "Arquitectura costa",
      href: "/templates/budget/template-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates/budget/template-1");
  });

  it("keeps a successful template update when activity logging fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.updateUserBudgetTemplate.mockResolvedValue({ id: "template-1", name: "Arquitectura costa" });
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await PATCH(
      new Request("http://localhost/api/templates/budget/template-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Arquitectura costa" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "template-1", name: "Arquitectura costa" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates/budget/template-1");
  });

  it("rejects template updates without a name", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(
      new Request("http://localhost/api/templates/budget/template-1", {
        method: "PATCH",
        body: JSON.stringify({ description: "Sin nombre" }),
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "El nombre de la plantilla es obligatorio" });
    expect(mocks.updateUserBudgetTemplate).not.toHaveBeenCalled();
    expect(mocks.recordActivityEvent).not.toHaveBeenCalled();
  });

  it("deletes a template owned by the current user", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.deleteUserBudgetTemplate.mockResolvedValue({ id: "template-1", name: "Arquitectura costa" });

    const response = await DELETE(
      new Request("http://localhost/api/templates/budget/template-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteUserBudgetTemplate).toHaveBeenCalledWith("template-1", "user-1");
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "BUDGET_UPDATED",
      title: "Plantilla eliminada",
      detail: "Arquitectura costa",
      href: "/templates",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates/budget/template-1");
  });

  it("keeps a successful template deletion when activity logging fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.deleteUserBudgetTemplate.mockResolvedValue({ id: "template-1", name: "Arquitectura costa" });
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await DELETE(
      new Request("http://localhost/api/templates/budget/template-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "template-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates/budget/template-1");
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/templates/budget/template-1"), {
      params: Promise.resolve({ id: "template-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.deleteUserBudgetTemplate).not.toHaveBeenCalled();
    expect(mocks.recordActivityEvent).not.toHaveBeenCalled();
  });
});
