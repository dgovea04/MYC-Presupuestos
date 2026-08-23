import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  exportDelphinSqliteProject: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/runtime/local-capabilities", () => ({
  isLocalServerRuntimeEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/delphin/sqlite-reader", () => ({
  exportDelphinSqliteProject: mocks.exportDelphinSqliteProject,
}));

vi.mock("@/lib/s10/snapshot-contract", () => ({
  parseS10SnapshotJson: vi.fn((json: string) => {
    const parsed = JSON.parse(json);
    return { contract: parsed, warnings: [] };
  }),
}));

import { POST } from "@/app/api/imports/delphin/sqlite/export/route";

function buildSnapshot() {
  return {
    presupuestos: [{ CodPresupuesto: "DELPHIN", Descripcion: "Test", Moneda: "S/.", CostoOferta1: 1000 }],
    subpresupuestos: [],
    partidas: [],
    budgetLevels: [],
    subpresupuestoDetalles: [],
    apuDetalles: [],
    pieSubpresupuestos: [],
    resultadoPieSubpresupuestos: [],
  };
}

describe("POST /api/imports/delphin/sqlite/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns 401 without auth", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/imports/delphin/sqlite/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "test.sqlite", projectId: "PR01" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 without path", async () => {
    const response = await POST(
      new Request("http://localhost/api/imports/delphin/sqlite/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "PR01" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 without projectId", async () => {
    const response = await POST(
      new Request("http://localhost/api/imports/delphin/sqlite/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "test.sqlite" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("exports a project and returns the snapshot contract", async () => {
    mocks.exportDelphinSqliteProject.mockReturnValue(buildSnapshot());
    const response = await POST(
      new Request("http://localhost/api/imports/delphin/sqlite/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "test.sqlite", projectId: "PR0000000001" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.presupuestos[0].Descripcion).toBe("Test");
  });

  it("returns 400 on export error", async () => {
    mocks.exportDelphinSqliteProject.mockImplementation(() => {
      throw new Error("Project not found");
    });
    const response = await POST(
      new Request("http://localhost/api/imports/delphin/sqlite/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "test.sqlite", projectId: "NONEXISTENT" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});