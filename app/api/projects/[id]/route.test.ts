import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateProject: vi.fn(),
  getProjectHeaderById: vi.fn(),
  deleteProject: vi.fn(),
  recordActivityEvent: vi.fn(),
  getAuthSession: vi.fn(),
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

vi.mock("@/lib/data/projects", () => ({
  updateProject: mocks.updateProject,
  getProjectHeaderById: mocks.getProjectHeaderById,
  deleteProject: mocks.deleteProject,
  getProjectOverviewCacheTag: (projectId: string) => `project-overview:${projectId}`,
  PROJECT_OVERVIEW_CACHE_TAG: "project-overview",
  PROJECTS_LIST_CACHE_TAG: "projects-list",
  USER_COMPANIES_CACHE_TAG: "user-companies",
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

vi.mock("@/lib/dashboard/analytics", () => ({
  DASHBOARD_ANALYTICS_CACHE_TAG: "dashboard-analytics",
  getDashboardAnalyticsCacheTag: (companyId: string) => `dashboard-analytics:${companyId}`,
}));

import { PATCH, DELETE } from "@/app/api/projects/[id]/route";

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    mocks.updateProject.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when workspace membership validation fails on update", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.updateProject.mockRejectedValue(new Error("Workspace no disponible"));

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Workspace no disponible" });
  });

  it("returns 400 when user has insufficient role for project update", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.updateProject.mockRejectedValue(new Error("No tienes el rol necesario en este workspace"));

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes el rol necesario en este workspace" });
  });

  it("updates a project successfully and records activity", async () => {
    const project = { id: "project-1", name: "Updated Name", companyId: "company-1" };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.updateProject.mockResolvedValue(project);
    mocks.recordActivityEvent.mockResolvedValue(undefined);

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(project);
    expect(mocks.updateProject).toHaveBeenCalledWith("project-1", "user-1", { name: "Updated Name" });
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "PROJECT_UPDATED",
      title: "Proyecto actualizado",
      detail: "Updated Name",
      href: "/projects/project-1",
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("dashboard-analytics:company-1", "max");
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    mocks.getProjectHeaderById.mockReset();
    mocks.deleteProject.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/projects/project-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when project is not found or user has no access", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/projects/project-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permisos para eliminar este proyecto" });
  });

  it("returns 400 when workspace membership validation fails on delete", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Test", companyId: "company-1" });
    mocks.deleteProject.mockRejectedValue(new Error("Workspace no disponible"));

    const response = await DELETE(
      new Request("http://localhost/api/projects/project-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Workspace no disponible" });
  });

  it("returns 400 when user has insufficient role to delete (needs ADMIN)", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Test", companyId: "company-1" });
    mocks.deleteProject.mockRejectedValue(new Error("No tienes el rol necesario en este workspace"));

    const response = await DELETE(
      new Request("http://localhost/api/projects/project-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes el rol necesario en este workspace" });
  });

  it("deletes a project successfully", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Test", companyId: "company-1" });
    mocks.deleteProject.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/projects/project-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteProject).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("dashboard-analytics:company-1", "max");
  });
});
