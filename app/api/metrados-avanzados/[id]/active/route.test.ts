import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getFeatureAccessResponse: vi.fn(),
  setMetradoSheetActiveState: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/billing/route-access", () => ({ getFeatureAccessResponse: mocks.getFeatureAccessResponse }));
vi.mock("@/lib/data/metrados", () => ({ setMetradoSheetActiveState: mocks.setMetradoSheetActiveState }));

import { PATCH } from "@/app/api/metrados-avanzados/[id]/active/route";

describe("PATCH /api/metrados-avanzados/[id]/active", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getFeatureAccessResponse.mockResolvedValue(null);
    mocks.setMetradoSheetActiveState.mockReset();
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ isActive: true }) }), { params: Promise.resolve({ id: "sheet-1" }) });
    expect(response.status).toBe(401);
  });

  it("rejects an invalid active state", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ isActive: "yes" }) }), { params: Promise.resolve({ id: "sheet-1" }) });
    expect(response.status).toBe(400);
  });

  it("reactivates a historical sheet", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    const sheet = { id: "sheet-1", isActive: true };
    mocks.setMetradoSheetActiveState.mockResolvedValue(sheet);

    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ isActive: true }) }), { params: Promise.resolve({ id: "sheet-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sheet });
    expect(mocks.setMetradoSheetActiveState).toHaveBeenCalledWith({ sheetId: "sheet-1", userId: "user-1", isActive: true });
  });
});
