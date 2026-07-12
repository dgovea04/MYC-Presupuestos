import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createResourceForUser: vi.fn(),
  saveResourcesPatch: vi.fn(),
  resourcePatchTouchesGlobalCatalog: vi.fn(),
  clearResourcesProcessCache: vi.fn(),
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

vi.mock("@/lib/data/resources", () => ({
  createResourceForUser: mocks.createResourceForUser,
  saveResourcesPatch: mocks.saveResourcesPatch,
  resourcePatchTouchesGlobalCatalog: mocks.resourcePatchTouchesGlobalCatalog,
  clearResourcesProcessCache: mocks.clearResourcesProcessCache,
  GLOBAL_RESOURCES_CACHE_TAG: "global-resources-v2",
  RESOURCES_BY_USER_CACHE_TAG: "resources-by-user",
}));

import { POST, PATCH } from "@/app/api/resources/route";

describe("POST /api/resources", () => {
  beforeEach(() => {
    mocks.createResourceForUser.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.clearResourcesProcessCache.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/resources", {
        method: "POST",
        body: JSON.stringify({ description: "Test resource" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when workspace membership validation fails on create", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createResourceForUser.mockRejectedValue(
      new Error("No puedes crear insumos en una empresa que no te pertenece"),
    );

    const response = await POST(
      new Request("http://localhost/api/resources", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-2", description: "Cemento", category: "MATERIAL", unit: "bolsa", unitPrice: 25 } as Record<string, unknown>),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No puedes crear insumos en una empresa que no te pertenece" });
  });

  it("creates a resource successfully", async () => {
    const resource = { id: "resource-1", description: "Cemento", companyId: "company-1" };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createResourceForUser.mockResolvedValue(resource);

    const response = await POST(
      new Request("http://localhost/api/resources", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1", description: "Cemento", category: "MATERIAL", unit: "bolsa", unitPrice: 25 } as Record<string, unknown>),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(resource);
    expect(mocks.createResourceForUser).toHaveBeenCalledWith("user-1", expect.any(Object));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/resources");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("resources-by-user", "max");
  });

  it("creates a global resource (no companyId) and revalidates global cache", async () => {
    const resource = { id: "resource-2", description: "Clavo", companyId: null };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createResourceForUser.mockResolvedValue(resource);

    const response = await POST(
      new Request("http://localhost/api/resources", {
        method: "POST",
        body: JSON.stringify({ description: "Clavo", category: "MATERIAL", unit: "kg", unitPrice: 5 } as Record<string, unknown>),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("global-resources-v2", "max");
  });
});

describe("PATCH /api/resources", () => {
  beforeEach(() => {
    mocks.saveResourcesPatch.mockReset();
    mocks.resourcePatchTouchesGlobalCatalog.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.clearResourcesProcessCache.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/resources", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when workspace membership validation fails on patch", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourcePatchTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.saveResourcesPatch.mockRejectedValue(
      new Error("No puedes crear o mover insumos a una empresa que no te pertenece"),
    );

    const response = await PATCH(
      new Request("http://localhost/api/resources", {
        method: "PATCH",
        body: JSON.stringify({
          create: [{ clientId: "c1", data: { companyId: "company-2", description: "Test", category: "MATERIAL", unit: "unidad", unitPrice: 10 } }],
          update: [],
          delete: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No puedes crear o mover insumos a una empresa que no te pertenece" });
  });

  it("applies a resource patch successfully", async () => {
    const result = {
      created: [{ clientId: "c1", resource: { id: "resource-1" } }],
      updated: [],
      deleted: [],
      savedAt: "2026-01-01T00:00:00.000Z",
    };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourcePatchTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.saveResourcesPatch.mockResolvedValue(result);

    const response = await PATCH(
      new Request("http://localhost/api/resources", {
        method: "PATCH",
        body: JSON.stringify({
          create: [{ clientId: "c1", data: { companyId: "company-1", description: "Test", category: "MATERIAL", unit: "unidad", unitPrice: 10 } }],
          update: [],
          delete: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(mocks.saveResourcesPatch).toHaveBeenCalledWith("user-1", expect.any(Object));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/resources");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("resources-by-user", "max");
  });

  it("revalidates global catalog tag when patch touches global resources", async () => {
    const result = { created: [], updated: [{ id: "resource-1" }], deleted: [], savedAt: "2026-01-01T00:00:00.000Z" };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourcePatchTouchesGlobalCatalog.mockResolvedValue(true);
    mocks.saveResourcesPatch.mockResolvedValue(result);

    const response = await PATCH(
      new Request("http://localhost/api/resources", {
        method: "PATCH",
        body: JSON.stringify({ create: [], update: [], delete: [] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("global-resources-v2", "max");
  });
});
