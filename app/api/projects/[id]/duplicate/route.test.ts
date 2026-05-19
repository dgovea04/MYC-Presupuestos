import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  duplicateProject: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  duplicateProject: mocks.duplicateProject,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

import { POST } from "@/app/api/projects/[id]/duplicate/route";

describe("POST /api/projects/[id]/duplicate", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.duplicateProject.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/projects/project-1/duplicate"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("duplicates the project, records activity, and revalidates project views", async () => {
    const duplicatedProject = {
      id: "project-copy",
      name: "Hospital Norte (copia)",
    };

    mocks.getAuthSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.duplicateProject.mockResolvedValue(duplicatedProject);

    const response = await POST(new Request("http://localhost/api/projects/project-1/duplicate"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(duplicatedProject);
    expect(mocks.duplicateProject).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "PROJECT_CREATED",
      title: "Proyecto duplicado",
      detail: "Hospital Norte (copia)",
      href: "/projects/project-copy",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-copy");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
  });

  it("returns success when activity logging fails after duplication succeeds", async () => {
    const duplicatedProject = {
      id: "project-copy",
      name: "Hospital Norte (copia)",
    };

    mocks.getAuthSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.duplicateProject.mockResolvedValue(duplicatedProject);
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await POST(new Request("http://localhost/api/projects/project-1/duplicate"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(duplicatedProject);
    expect(mocks.duplicateProject).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.recordActivityEvent).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-copy");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
  });

  it("returns a route-specific 400 payload when duplication fails", async () => {
    mocks.getAuthSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.duplicateProject.mockRejectedValue(new Error("No tienes permisos para duplicar este proyecto"));

    const response = await POST(new Request("http://localhost/api/projects/project-1/duplicate"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permisos para duplicar este proyecto" });
    expect(mocks.recordActivityEvent).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
