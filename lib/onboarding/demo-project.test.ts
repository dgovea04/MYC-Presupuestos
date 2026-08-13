import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  projectFindFirst: vi.fn(),
  analyzeProjectPackageBuffer: vi.fn(),
  importProjectPackageToMyc: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findFirst: mocks.projectFindFirst,
    },
  },
}));

vi.mock("@/lib/mcp/import-preview", () => ({
  analyzeProjectPackageBuffer: mocks.analyzeProjectPackageBuffer,
}));

vi.mock("@/lib/mcp/import-persistence", () => ({
  importProjectPackageToMyc: mocks.importProjectPackageToMyc,
}));

import { ensureDemoProjectForCompany } from "@/lib/onboarding/demo-project";

describe("ensureDemoProjectForCompany", () => {
  beforeEach(() => {
    mocks.readFile.mockReset();
    mocks.projectFindFirst.mockReset();
    mocks.analyzeProjectPackageBuffer.mockReset();
    mocks.importProjectPackageToMyc.mockReset();
  });

  it("skips when disabled", async () => {
    await expect(
      ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1", enabled: false }),
    ).resolves.toEqual({
      status: "skipped",
      projectId: null,
      generalBudgetId: null,
      warnings: [],
    });
  });

  it("returns already_exists when company already has the demo", async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: "project-demo", budgets: [{ id: "budget-general" }] });

    await expect(
      ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1" }),
    ).resolves.toEqual({
      status: "already_exists",
      projectId: "project-demo",
      generalBudgetId: "budget-general",
      warnings: [],
    });

    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.importProjectPackageToMyc).not.toHaveBeenCalled();
  });

  it("imports the demo project from the mcp asset", async () => {
    const buffer = Buffer.from("mcp-data");
    const manifest = { project: { name: "Original" } };
    const fileContents = new Map<string, string>([
      ["project.json", JSON.stringify({ name: "Original" })],
    ]);

    mocks.projectFindFirst.mockResolvedValue(null);
    mocks.readFile.mockResolvedValue(buffer);
    mocks.analyzeProjectPackageBuffer.mockReturnValue({
      manifest,
      fileContents,
      preview: { compatibility: "supported", errors: [] },
    });
    mocks.importProjectPackageToMyc.mockResolvedValue({
      projectId: "project-created",
      generalBudgetId: "budget-created",
      warnings: ["formula warning"],
    });

    await expect(
      ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1" }),
    ).resolves.toEqual({
      status: "created",
      projectId: "project-created",
      generalBudgetId: "budget-created",
      warnings: ["formula warning"],
    });

    expect(mocks.importProjectPackageToMyc).toHaveBeenCalledWith(
      "user-1",
      manifest,
      expect.any(Function),
      {
        companyId: "company-1",
        mode: "restore_as_new_project",
        projectOverrides: {
          name: "Edificio Multifamiliar - Demo",
          clientName: "Cliente Demo",
          location: "Lima, Peru",
          projectType: "Edificacion",
          isDemo: true,
          demoKey: "edificio-multifamiliar",
        },
      },
    );
  });

  it("returns failed when the template cannot be imported", async () => {
    mocks.projectFindFirst.mockResolvedValue(null);
    mocks.readFile.mockRejectedValue(new Error("missing file"));

    const result = await ensureDemoProjectForCompany({ userId: "user-1", companyId: "company-1" });

    expect(result.status).toBe("failed");
    expect(result.projectId).toBeNull();
    expect(result.generalBudgetId).toBeNull();
    expect(result.warnings[0]).toContain("No se pudo crear el proyecto demo");
  });
});
