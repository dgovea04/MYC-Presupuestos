import { describe, expect, it, vi } from "vitest";

const {
  prismaFindUniqueMock,
  getUserSettingsMock,
  updateUserSettingsMock,
  revalidateTagMock,
} = vi.hoisted(() => ({
  prismaFindUniqueMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: prismaFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: getUserSettingsMock,
  updateUserSettings: updateUserSettingsMock,
  USER_SETTINGS_CACHE_TAG: "user-settings",
}));

import { POST } from "@/app/api/dev/set-view-mode/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/dev/set-view-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const baseSettings = {
  defaultCurrency: "PEN",
  currencyDecimals: 2,
  dateFormat: "DD_MMM_YYYY",
  appTheme: "light" as const,
  defaultViewMode: "modern" as const,
  excelShowFieldBorders: true,
  excelRowHeight: 28,
  defaultIgvRate: 0.18,
  defaultGeneralExpensesRate: 0.1,
  defaultUtilityRate: 0.08,
  defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
  aiProviderPreference: "auto" as const,
};

describe("dev /api/dev/set-view-mode", () => {
  it("returns 404 in production environments regardless of payload", async () => {
    vi.stubEnv("NODE_ENV", "production");
    prismaFindUniqueMock.mockReset();
    getUserSettingsMock.mockReset();
    updateUserSettingsMock.mockReset();
    revalidateTagMock.mockReset();

    const response = await POST(
      makeRequest({ email: "demo@mycpresupuestos.pe", viewMode: "excel" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(prismaFindUniqueMock).not.toHaveBeenCalled();
    expect(updateUserSettingsMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(makeRequest("{not-json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(prismaFindUniqueMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns 400 when the payload fails schema validation (missing viewMode)", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(makeRequest({ email: "demo@mycpresupuestos.pe" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request",
      issues: expect.any(Array),
    });
    expect(prismaFindUniqueMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns 400 when the viewMode value is not in the allowed enum", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(
      makeRequest({ email: "demo@mycpresupuestos.pe", viewMode: "narrative" }),
    );

    expect(response.status).toBe(400);
    expect(prismaFindUniqueMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns 404 when the user lookup fails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    prismaFindUniqueMock.mockReset();
    prismaFindUniqueMock.mockResolvedValueOnce(null);

    const response = await POST(
      makeRequest({ email: "unknown@example.com", viewMode: "excel" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "User not found: unknown@example.com",
    });
    expect(getUserSettingsMock).not.toHaveBeenCalled();
    expect(updateUserSettingsMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("flips defaultViewMode to excel and returns 200 with the persisted value", async () => {
    vi.stubEnv("NODE_ENV", "development");
    prismaFindUniqueMock.mockReset();
    getUserSettingsMock.mockReset();
    updateUserSettingsMock.mockReset();
    revalidateTagMock.mockReset();

    prismaFindUniqueMock.mockResolvedValueOnce({ id: "user-1" });
    getUserSettingsMock.mockResolvedValueOnce(baseSettings);
    updateUserSettingsMock.mockResolvedValueOnce({
      ...baseSettings,
      defaultViewMode: "excel",
    });

    const response = await POST(
      makeRequest({ email: "demo@mycpresupuestos.pe", viewMode: "excel" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "user-1",
      email: "demo@mycpresupuestos.pe",
      defaultViewMode: "excel",
    });

    expect(getUserSettingsMock).toHaveBeenCalledWith("user-1");
    expect(updateUserSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ defaultViewMode: "excel" }),
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("user-settings", "max");
    expect(revalidateTagMock).toHaveBeenCalledWith("user-settings:user-1", "max");
    // Guard the order assertion: without this, if a future refactor drops
    // the revalidateTag call entirely, `invocationCallOrder[0]` is undefined
    // and `.toBeLessThan(...)` would silently pass.
    expect(revalidateTagMock).toHaveBeenCalled();
    // Pin the invariant: DB write must land BEFORE cache invalidation,
    // otherwise SSR'd consumers read stale settings.
    expect(updateUserSettingsMock.mock.invocationCallOrder[0]).toBeLessThan(
      revalidateTagMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    vi.unstubAllEnvs();
  });

  it("can also flip back to modern for test isolation", async () => {
    vi.stubEnv("NODE_ENV", "development");
    prismaFindUniqueMock.mockReset();
    getUserSettingsMock.mockReset();
    updateUserSettingsMock.mockReset();
    revalidateTagMock.mockReset();

    prismaFindUniqueMock.mockResolvedValueOnce({ id: "user-1" });
    getUserSettingsMock.mockResolvedValueOnce({ ...baseSettings, defaultViewMode: "excel" });
    updateUserSettingsMock.mockResolvedValueOnce({ ...baseSettings, defaultViewMode: "modern" });

    prismaFindUniqueMock.mockResolvedValueOnce({ id: "user-1" });
    getUserSettingsMock.mockResolvedValueOnce({ ...baseSettings, defaultViewMode: "excel" });
    updateUserSettingsMock.mockResolvedValueOnce({ ...baseSettings, defaultViewMode: "modern" });

    const response = await POST(
      makeRequest({ email: "demo@mycpresupuestos.pe", viewMode: "modern" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "user-1",
      email: "demo@mycpresupuestos.pe",
      defaultViewMode: "modern",
    });
    expect(updateUserSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ defaultViewMode: "modern" }),
    );
    vi.unstubAllEnvs();
  });
});
