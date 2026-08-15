import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  duplicateMetradoSheet: vi.fn(),
  getAuthSession: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

vi.mock("@/lib/data/metrados", () => ({
  duplicateMetradoSheet: mocks.duplicateMetradoSheet,
}));

vi.mock("@/lib/billing/route-access", () => ({
  getFeatureAccessResponse: vi.fn().mockResolvedValue(null),
}));

import { POST } from "@/app/api/metrados-avanzados/[id]/duplicate/route";

describe("POST /api/metrados-avanzados/[id]/duplicate", () => {
  beforeEach(() => {
    mocks.duplicateMetradoSheet.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("duplicates a metrado sheet owned by the current user", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.duplicateMetradoSheet.mockResolvedValue({ id: "sheet-copy", name: "Metrado zapatas copia" });

    const response = await POST(
      new Request("http://localhost/api/metrados-avanzados/sheet-1/duplicate", {
        method: "POST",
        body: JSON.stringify({ name: "Metrado zapatas copia" }),
      }),
      { params: Promise.resolve({ id: "sheet-1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      sheet: { id: "sheet-copy", name: "Metrado zapatas copia" },
    });
    expect(mocks.duplicateMetradoSheet).toHaveBeenCalledWith({
      sourceSheetId: "sheet-1",
      userId: "user-1",
      name: "Metrado zapatas copia",
    });
    expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
      userId: "user-1",
      type: "BUDGET_UPDATED",
      title: "Metrado duplicado",
      detail: "Metrado zapatas copia creado como base reutilizable",
      href: "/metrados-avanzados",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/metrados-avanzados");
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/metrados-avanzados/sheet-1/duplicate"), {
      params: Promise.resolve({ id: "sheet-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.duplicateMetradoSheet).not.toHaveBeenCalled();
  });

  it("keeps the duplicate successful when activity logging fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.duplicateMetradoSheet.mockResolvedValue({ id: "sheet-copy", name: "Metrado zapatas copia" });
    mocks.recordActivityEvent.mockRejectedValue(new Error("activity unavailable"));

    const response = await POST(new Request("http://localhost/api/metrados-avanzados/sheet-1/duplicate"), {
      params: Promise.resolve({ id: "sheet-1" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      sheet: { id: "sheet-copy", name: "Metrado zapatas copia" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
