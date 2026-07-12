import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  resourceMutationTouchesGlobalCatalog: vi.fn(),
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
  updateResource: mocks.updateResource,
  deleteResource: mocks.deleteResource,
  resourceMutationTouchesGlobalCatalog: mocks.resourceMutationTouchesGlobalCatalog,
  clearResourcesProcessCache: mocks.clearResourcesProcessCache,
  GLOBAL_RESOURCES_CACHE_TAG: "global-resources-v2",
  RESOURCES_BY_USER_CACHE_TAG: "resources-by-user",
}));

import { PATCH, DELETE } from "@/app/api/resources/[id]/route";

describe("PATCH /api/resources/[id]", () => {
  beforeEach(() => {
    mocks.updateResource.mockReset();
    mocks.resourceMutationTouchesGlobalCatalog.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.clearResourcesProcessCache.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/resources/resource-1", {
        method: "PATCH",
        body: JSON.stringify({ description: "Updated" }),
      }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when workspace membership validation fails on update", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.updateResource.mockRejectedValue(new Error("No tienes permisos para editar este insumo"));

    const response = await PATCH(
      new Request("http://localhost/api/resources/resource-1", {
        method: "PATCH",
        body: JSON.stringify({ description: "Updated", category: "MATERIAL", unit: "kg", unitPrice: 10 } as Record<string, unknown>),
      }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permisos para editar este insumo" });
  });

  it("updates a resource successfully", async () => {
    const resource = { id: "resource-1", description: "Updated", companyId: "company-1" };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.updateResource.mockResolvedValue(resource);

    const response = await PATCH(
      new Request("http://localhost/api/resources/resource-1", {
        method: "PATCH",
        body: JSON.stringify({ description: "Updated", category: "MATERIAL", unit: "kg", unitPrice: 10 } as Record<string, unknown>),
      }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(resource);
    expect(mocks.updateResource).toHaveBeenCalledWith("resource-1", "user-1", expect.any(Object));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/resources");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("resources-by-user", "max");
  });

  it("revalidates global catalog when updating a global resource", async () => {
    const resource = { id: "resource-1", description: "Updated", companyId: null };

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(true);
    mocks.updateResource.mockResolvedValue(resource);

    const response = await PATCH(
      new Request("http://localhost/api/resources/resource-1", {
        method: "PATCH",
        body: JSON.stringify({ description: "Updated", category: "MATERIAL", unit: "kg", unitPrice: 10 } as Record<string, unknown>),
      }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("global-resources-v2", "max");
  });
});

describe("DELETE /api/resources/[id]", () => {
  beforeEach(() => {
    mocks.deleteResource.mockReset();
    mocks.resourceMutationTouchesGlobalCatalog.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.clearResourcesProcessCache.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/resources/resource-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when workspace membership validation fails on delete", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.deleteResource.mockRejectedValue(new Error("No tienes permisos para eliminar este insumo"));

    const response = await DELETE(
      new Request("http://localhost/api/resources/resource-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permisos para eliminar este insumo" });
  });

  it("returns 400 when resource is used in an APU", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.deleteResource.mockRejectedValue(
      new Error("No puedes eliminar un insumo que ya esta usado en un APU"),
    );

    const response = await DELETE(
      new Request("http://localhost/api/resources/resource-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No puedes eliminar un insumo que ya esta usado en un APU" });
  });

  it("deletes a resource successfully", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(false);
    mocks.deleteResource.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/resources/resource-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteResource).toHaveBeenCalledWith("resource-1", "user-1");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("resources-by-user", "max");
  });

  it("revalidates global catalog when deleting a global resource", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.resourceMutationTouchesGlobalCatalog.mockResolvedValue(true);
    mocks.deleteResource.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/resources/resource-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "resource-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("global-resources-v2", "max");
  });
});
