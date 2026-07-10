import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/billing/api", () => ({
  createBillingErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/mcp/import-preview", () => ({
  analyzeProjectPackageBuffer: vi.fn(),
}));

vi.mock("@/lib/mcp/import-persistence", () => ({
  importProjectPackageToMyc: vi.fn(),
}));

import { POST } from "@/app/api/imports/mcp/import/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";
import { importProjectPackageToMyc } from "@/lib/mcp/import-persistence";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1", ...overrides },
  };
}

function makeAnalyzeResult(overrides: Record<string, unknown> = {}) {
  return {
    preview: {
      compatibility: "supported",
      projectName: "Proyecto de prueba",
      formatVersion: "1.0.0",
      sourceApp: "MC Presupuestos",
      sourceAppVersion: "0.1.0",
      modules: [],
      warnings: [],
      errors: [],
      ...overrides,
    },
    manifest: {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      project: { name: "Proyecto de prueba", currency: "PEN" },
      ...(overrides.manifest as Record<string, unknown> ?? {}),
    },
    fileContents: new Map([["manifest.json", "{}"]]),
  };
}

function makeValidFormData(companyId = "company-1") {
  const formData = new FormData();
  formData.set("file", new File([Buffer.from("mock-mcp-data")], "proyecto.mcp"));
  formData.set("companyId", companyId);
  return formData;
}

describe("POST /api/imports/mcp/import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("No autorizado");
  });

  it("returns 400 when file is missing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const formData = new FormData();
    formData.set("companyId", "company-1");

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Adjunta un archivo");
  });

  it("returns 400 when companyId is missing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(""),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("empresa");
  });

  it("returns 400 when user has no workspace membership", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockRejectedValue(new Error("Workspace no disponible"));

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Workspace no disponible");
  });

  it("returns 400 when user has insufficient role", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockRejectedValue(
      new Error("No tienes el rol necesario en este workspace"),
    );

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("rol necesario");
  });

  it("calls assertWorkspaceMembership with correct params", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(analyzeProjectPackageBuffer).mockReturnValue(makeAnalyzeResult() as never);
    vi.mocked(importProjectPackageToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(assertWorkspaceMembership).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      minimumRole: "EDITOR",
    });
    expect(response.status).toBe(201);
  });

  it("returns 400 when .mcp package is unsupported", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(analyzeProjectPackageBuffer).mockReturnValue(
      makeAnalyzeResult({
        compatibility: "unsupported",
        errors: ["Falta el modulo obligatorio project.json."],
      }) as never,
    );

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("no es compatible");
  });

  it("returns 400 when .mcp file has wrong extension", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const formData = new FormData();
    formData.set("file", new File([Buffer.from("data")], "proyecto.zip"));
    formData.set("companyId", "company-1");

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("extension .mcp");
  });

  it("returns 201 and calls import service on success", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(analyzeProjectPackageBuffer).mockReturnValue(makeAnalyzeResult() as never);
    vi.mocked(importProjectPackageToMyc).mockResolvedValue({
      projectId: "project-mcp-1",
      projectName: "Proyecto de prueba",
      generalBudgetId: "budget-mcp-g",
      subBudgetIds: ["budget-mcp-1"],
      budgetCount: 2,
      itemCount: 5,
      apuCount: 3,
      resourceCount: 0,
      warnings: [],
    } as never);

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.projectId).toBe("project-mcp-1");
    expect(body.projectName).toBe("Proyecto de prueba");
    expect(body.generalBudgetId).toBe("budget-mcp-g");
    expect(body.subBudgetIds).toEqual(["budget-mcp-1"]);
    expect(body.budgetCount).toBe(2);
    expect(body.itemCount).toBe(5);
    expect(body.apuCount).toBe(3);
  });

  it("passes the readModule callback to importProjectPackageToMyc", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);

    // Set up the analysis with actual file contents
    const manifestContent = JSON.stringify({
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      project: { name: "Test", currency: "PEN" },
      modules: [],
      checksums: {},
    });
    vi.mocked(analyzeProjectPackageBuffer).mockReturnValue({
      preview: {
        compatibility: "supported",
        projectName: "Test",
        formatVersion: "1.0.0",
        sourceApp: "MC Presupuestos",
        sourceAppVersion: "0.1.0",
        modules: [],
        warnings: [],
        errors: [],
      },
      manifest: JSON.parse(manifestContent),
      fileContents: new Map([["manifest.json", manifestContent]]),
    } as never);

    vi.mocked(importProjectPackageToMyc).mockResolvedValue({
      projectId: "project-1",
      projectName: "Test",
      generalBudgetId: "budget-1",
      subBudgetIds: [],
      budgetCount: 1,
      itemCount: 0,
      apuCount: 0,
      resourceCount: 0,
      warnings: [],
    });

    await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    // Verify importProjectPackageToMyc was called with a readModule function
    const importCall = vi.mocked(importProjectPackageToMyc).mock.calls[0];
    expect(importCall).toBeDefined();
    expect(importCall[0]).toBe("user-1"); // userId
    expect(importCall[1]).toBeDefined(); // manifest
    expect(typeof importCall[2]).toBe("function"); // readModule function
    expect(importCall[3]).toEqual({ companyId: "company-1", mode: "restore_as_new_project" });
  });

  it("returns warnings from import result when present", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(analyzeProjectPackageBuffer).mockReturnValue(makeAnalyzeResult() as never);
    vi.mocked(importProjectPackageToMyc).mockResolvedValue({
      projectId: "project-2",
      projectName: "Proyecto con warnings",
      generalBudgetId: "budget-g-2",
      subBudgetIds: [],
      budgetCount: 1,
      itemCount: 0,
      apuCount: 0,
      resourceCount: 0,
      warnings: ["No se pudo restaurar la formula polinomica."],
    });

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.warnings).toContain("No se pudo restaurar la formula polinomica.");
  });

  it("asserts membership before analyzing the package", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(analyzeProjectPackageBuffer).mockReturnValue(makeAnalyzeResult() as never);
    vi.mocked(importProjectPackageToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    await POST(
      new Request("http://localhost/api/imports/mcp/import", {
        method: "POST",
        body: makeValidFormData(),
      }),
    );

    const assertCallOrder = vi.mocked(assertWorkspaceMembership).mock.invocationCallOrder[0];
    const analyzeCallOrder = vi.mocked(analyzeProjectPackageBuffer).mock.invocationCallOrder[0];
    const importCallOrder = vi.mocked(importProjectPackageToMyc).mock.invocationCallOrder[0];

    expect(assertCallOrder).toBeLessThan(analyzeCallOrder);
    expect(analyzeCallOrder).toBeLessThan(importCallOrder);
  });
});
