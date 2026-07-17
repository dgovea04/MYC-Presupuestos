import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/work-schedule", () => ({
  getWorkScheduleGenerationSettings: vi.fn(),
  saveWorkScheduleGenerationSettings: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/entitlements")>();

  return {
    ...actual,
    assertFeatureAccess: vi.fn(),
  };
});

import { GET, PUT } from "@/app/api/budgets/[id]/work-schedule/generation-settings/route";
import { getAuthSession } from "@/lib/auth/session";
import {
  getWorkScheduleGenerationSettings,
  saveWorkScheduleGenerationSettings,
} from "@/lib/data/work-schedule";
import { assertFeatureAccess, FeatureAccessError } from "@/lib/billing/entitlements";

describe("budget work schedule generation settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns 401 when unauthenticated on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("returns 401 when unauthenticated on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: { structure: ["concreto"] } }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("returns an upgrade payload when the user does not have Pro access on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(assertFeatureAccess).mockRejectedValueOnce(new FeatureAccessError("work_schedule.intelligent"));

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Esta funcionalidad esta disponible en Pro.",
      feature: "work_schedule.intelligent",
      upgradeRequired: true,
      upgradeUrl: "/account",
    });
    expect(getWorkScheduleGenerationSettings).not.toHaveBeenCalled();
  });

  it("returns an upgrade payload when the user does not have Pro access on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(assertFeatureAccess).mockRejectedValueOnce(new FeatureAccessError("work_schedule.intelligent"));

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: { structure: ["concreto"] } }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Esta funcionalidad esta disponible en Pro.",
      feature: "work_schedule.intelligent",
      upgradeRequired: true,
      upgradeUrl: "/account",
    });
    expect(saveWorkScheduleGenerationSettings).not.toHaveBeenCalled();
  });

  it("returns the stored custom phase keywords on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getWorkScheduleGenerationSettings).mockResolvedValue({
      structure: ["concreto", "hormigon"],
      finishes: ["pintura", "ceramico"],
    });

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "work_schedule.intelligent" });
    expect(getWorkScheduleGenerationSettings).toHaveBeenCalledWith("budget-1", "user-1");
    await expect(response.json()).resolves.toEqual({
      customPhaseKeywords: {
        structure: ["concreto", "hormigon"],
        finishes: ["pintura", "ceramico"],
      },
    });
  });

  it("returns null custom phase keywords when no settings exist on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getWorkScheduleGenerationSettings).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ customPhaseKeywords: null });
  });

  it("persists custom phase keywords on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveWorkScheduleGenerationSettings).mockResolvedValue(undefined);

    const payload = {
      customPhaseKeywords: {
        structure: ["concreto", "hormigon"],
        finishes: ["pintura", "ceramico"],
      },
    };

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "work_schedule.intelligent" });
    expect(saveWorkScheduleGenerationSettings).toHaveBeenCalledWith("budget-1", "user-1", payload.customPhaseKeywords);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("returns 400 when the payload contains an invalid phase key on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: { invalidPhase: ["keyword"] } }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBeDefined();
    expect(saveWorkScheduleGenerationSettings).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload contains an empty keyword on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: { structure: [""] } }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBeDefined();
    expect(saveWorkScheduleGenerationSettings).not.toHaveBeenCalled();
  });

  it("saves empty customPhaseKeywords when the payload is missing the field on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveWorkScheduleGenerationSettings).mockResolvedValue(undefined);

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(saveWorkScheduleGenerationSettings).toHaveBeenCalledWith("budget-1", "user-1", {});
  });

  it.each([
    { label: "null", value: null },
    { label: "string", value: "structure" },
    { label: "number", value: 123 },
    { label: "array", value: ["structure"] },
  ])("returns 400 when customPhaseKeywords is $label on PUT", async ({ value }) => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: value }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBeDefined();
    expect(saveWorkScheduleGenerationSettings).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload contains an empty array on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: { structure: [] } }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    expect(saveWorkScheduleGenerationSettings).not.toHaveBeenCalled();
  });

  it("returns 400 when the data layer throws on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getWorkScheduleGenerationSettings).mockRejectedValue(new Error("Budget not found"));

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Budget not found" });
  });

  it("returns 400 when the data layer throws on PUT", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveWorkScheduleGenerationSettings).mockRejectedValue(new Error("Budget not found"));

    const response = await PUT(
      new Request("http://localhost/api/budgets/budget-1/work-schedule/generation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPhaseKeywords: { structure: ["concreto"] } }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Budget not found" });
  });
});
