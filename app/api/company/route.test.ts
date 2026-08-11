import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/company", () => ({
  upsertPrimaryCompany: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({
  USER_COMPANIES_CACHE_TAG: "user-companies",
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  WORKSPACE_LIST_CACHE_TAG: "user-workspaces",
}));

import { PATCH } from "@/app/api/company/route";
import { getAuthSession } from "@/lib/auth/session";
import { upsertPrimaryCompany } from "@/lib/data/company";
import { revalidateTag } from "next/cache";

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/company", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/company", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await PATCH(buildRequest({ name: "Constructora Andina SAC", ruc: "" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
    expect(upsertPrimaryCompany).not.toHaveBeenCalled();
  });

  it("creates or updates the user's primary company", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(upsertPrimaryCompany).mockResolvedValue({
      id: "company-1",
      userId: "user-1",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
      logoUrl: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await PATCH(buildRequest({ name: "Constructora Andina SAC", ruc: "20123456789" }));

    expect(response.status).toBe(200);
    expect(upsertPrimaryCompany).toHaveBeenCalledWith("user-1", {
      name: "Constructora Andina SAC",
      ruc: "20123456789",
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "company-1",
        name: "Constructora Andina SAC",
        ruc: "20123456789",
      }),
    );
    expect(revalidateTag).toHaveBeenCalledWith("user-workspaces", "max");
    expect(revalidateTag).toHaveBeenCalledWith("user-workspaces-user-1", "max");
  });

  it("returns validation feedback when company fields are invalid", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await PATCH(buildRequest({ name: "A", ruc: "123" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Revisa los datos de la empresa e intenta nuevamente.",
    });
    expect(upsertPrimaryCompany).not.toHaveBeenCalled();
  });
});
