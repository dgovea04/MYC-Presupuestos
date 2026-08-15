import { afterEach, describe, expect, it, vi } from "vitest";

const unstableCacheMock = vi.fn();
const projectFindManyMock = vi.fn();

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("next/cache", () => ({
  unstable_cache: unstableCacheMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findMany: projectFindManyMock,
    },
    company: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertWithinPlanLimit: vi.fn(),
}));

describe("project data cache behavior", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVitestEnv = process.env.VITEST;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VITEST = originalVitestEnv;
    unstableCacheMock.mockReset();
    projectFindManyMock.mockReset();
    vi.resetModules();
  });

  it("bypasses unstable_cache for project lists in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.VITEST = "";
    projectFindManyMock.mockResolvedValue([
      {
        id: "project-1",
        companyId: "company-1",
        name: "Hospital Norte",
        clientName: "Cliente",
        location: "Piura",
        projectType: "Edificacion",
        startDate: null,
        endDate: null,
        status: "PLANNING",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        _count: {
          budgets: 1,
        },
      },
    ]);
    unstableCacheMock.mockImplementation((fn: (...args: unknown[]) => unknown) => fn);

    const { getProjectsListByUser } = await import("@/lib/data/projects");

    const projects = await getProjectsListByUser("user-1");

    expect(projects).toHaveLength(1);
    expect(projectFindManyMock).toHaveBeenCalledWith({
      where: {
        companyId: undefined,
        company: {
          memberships: {
            some: {
              userId: "user-1",
              status: "ACTIVE",
            },
          },
        },
      },
      select: expect.objectContaining({
        id: true,
        companyId: true,
        name: true,
        clientName: true,
        location: true,
        projectType: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            budgets: {
              where: {
                kind: "GENERAL",
              },
            },
          },
        },
      }),
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(unstableCacheMock).not.toHaveBeenCalled();
  });
});
