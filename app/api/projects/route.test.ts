import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  getAuthSession: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  projectCount: vi.fn(),
  projectFindFirst: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  createProject: mocks.createProject,
}));

vi.mock("@/lib/dashboard/analytics", () => ({
  DASHBOARD_ANALYTICS_CACHE_TAG: "dashboard-analytics",
  getDashboardAnalyticsCacheTag: (companyId: string) => `dashboard-analytics:${companyId}`,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

vi.mock("@/lib/analytics/events", () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      count: mocks.projectCount,
      findFirst: mocks.projectFindFirst,
    },
  },
}));

import { POST } from "@/app/api/projects/route";

describe("POST /api/projects", () => {
  beforeEach(() => {
    mocks.createProject.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.projectCount.mockReset();
    mocks.projectFindFirst.mockReset();
    mocks.trackServerEvent.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/projects", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("creates a project and records template activity when a budget template is used", async () => {
    const project = { id: "project-1", name: "Hospital Norte", companyId: "company-1" };
    const body = {
      companyId: "company-1",
      name: "Hospital Norte",
      status: "PLANNING",
      templateId: "budget-edificacion-base",
    };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockResolvedValue(project);

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(project);
    expect(mocks.createProject).toHaveBeenCalledWith("user-1", body);
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "PROJECT_CREATED",
      title: "Proyecto creado desde plantilla",
      detail: "Hospital Norte | Presupuesto de edificacion base",
      href: "/projects/project-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-1");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("dashboard-analytics:company-1", "max");
  });

  it("tracks the first non-demo project after a demo project exists", async () => {
    const project = { id: "project-1", name: "Hospital Norte", companyId: "company-1", isDemo: false };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockResolvedValue(project);
    mocks.projectFindFirst.mockResolvedValue({ id: "demo-project-1" });
    mocks.projectCount.mockResolvedValue(1);

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", name: "Hospital Norte", status: "PLANNING" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("first_non_demo_project_created", {
      userId: "user-1",
      companyId: "company-1",
      projectId: "project-1",
    });
  });

  it("does not track later non-demo projects", async () => {
    const project = { id: "project-2", name: "Edificio Sur", companyId: "company-1", isDemo: false };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockResolvedValue(project);
    mocks.projectFindFirst.mockResolvedValue({ id: "demo-project-1" });
    mocks.projectCount.mockResolvedValue(2);

    await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", name: "Edificio Sur", status: "PLANNING" }),
      }),
    );

    expect(mocks.trackServerEvent).not.toHaveBeenCalled();
  });

  it("keeps a successful creation when activity logging fails", async () => {
    const project = { id: "project-1", name: "Hospital Norte", companyId: "company-1" };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockResolvedValue(project);
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", name: "Hospital Norte", status: "PLANNING" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(project);
    expect(mocks.recordActivityEvent).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("returns a billing-aware error when project creation fails with a plan limit", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockRejectedValue(new Error("No se pudo crear el proyecto"));

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", name: "Hospital Norte", status: "PLANNING" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo crear el proyecto" });
  });

  it("returns 400 when workspace membership validation fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockRejectedValue(new Error("Workspace no disponible"));

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-2", name: "Hospital Norte", status: "PLANNING" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Workspace no disponible" });
  });

  it("returns 400 when user has insufficient role for project creation", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockRejectedValue(new Error("No tienes el rol necesario en este workspace"));

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", name: "Hospital Norte", status: "PLANNING" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes el rol necesario en este workspace" });
  });

  it("returns the first Zod validation message when project creation payload is invalid", async () => {
    const { ZodError } = await import("zod");

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createProject.mockRejectedValue(
      new ZodError([
        {
          code: "too_small",
          origin: "string",
          minimum: 3,
          inclusive: true,
          path: ["name"],
          message: "Ingresa el nombre de la obra",
        },
      ]),
    );

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", name: "", status: "PLANNING" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Ingresa el nombre de la obra" });
  });
});
