import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/collaboration/versions", () => ({
  listBudgetVersionSnapshots: vi.fn(),
  createBudgetVersionSnapshot: vi.fn(),
}));

import { GET, POST } from "@/app/api/budgets/[id]/collaboration/versions/route";
import { getAuthSession } from "@/lib/auth/session";
import { listBudgetVersionSnapshots, createBudgetVersionSnapshot } from "@/lib/collaboration/versions";

const defaultVersion = {
  id: "version-1",
  budgetId: "budget-1",
  projectId: "project-1",
  companyId: "company-1",
  versionNumber: 1,
  label: "Revision inicial",
  reason: "Importacion S10 completada",
  createdById: "user-1",
  createdByName: "Juan Perez",
  createdAt: "2026-07-07T12:00:00.000Z",
};

const defaultVersionWithSnapshot = {
  ...defaultVersion,
  snapshot: { name: "Presupuesto General", currency: "PEN", levels: [], items: [] },
};

describe("collaboration versions route", () => {
  it("returns 401 when unauthenticated on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when unauthenticated on POST", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "v1", reason: "Manual" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("lists versions with defaults (no filters)", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetVersionSnapshots).mockResolvedValue([defaultVersion]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listBudgetVersionSnapshots).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      undefined,
      20,
    );
    await expect(response.json()).resolves.toEqual({ versions: [defaultVersion] });
  });

  it("forwards cursor and limit params", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetVersionSnapshots).mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/budgets/budget-1/collaboration/versions?cursor=2026-01-01T00:00:00.000Z&limit=5",
      ),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listBudgetVersionSnapshots).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      "2026-01-01T00:00:00.000Z",
      5,
    );
  });

  it("returns an empty versions array when no versions exist", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetVersionSnapshots).mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ versions: [] });
  });

  it("creates a version snapshot with label and reason", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(createBudgetVersionSnapshot).mockResolvedValue(defaultVersionWithSnapshot);

    const body = { label: "Revision final", reason: "Importacion S10 completada" };

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(201);
    expect(createBudgetVersionSnapshot).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      "Revision final",
      "Importacion S10 completada",
    );
    await expect(response.json()).resolves.toEqual({
      version: defaultVersionWithSnapshot,
    });
  });

  it("creates a version with no label or reason", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(createBudgetVersionSnapshot).mockResolvedValue({
      ...defaultVersionWithSnapshot,
      label: null,
      reason: null,
      versionNumber: 2,
    });

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(201);
    expect(createBudgetVersionSnapshot).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      undefined,
      undefined,
    );
  });

  it("returns 400 when createBudgetVersionSnapshot throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(createBudgetVersionSnapshot).mockRejectedValue(
      new Error("Presupuesto no encontrado"),
    );

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "v1" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Presupuesto no encontrado",
    });
  });

  it("returns 400 when listBudgetVersionSnapshots throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetVersionSnapshots).mockRejectedValue(
      new Error("No tienes permisos"),
    );

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No tienes permisos",
    });
  });

  it("rejects invalid version labels exceeding 200 chars", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "a".repeat(201) }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
  });
});
