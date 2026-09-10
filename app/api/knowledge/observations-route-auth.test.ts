import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postPriceObservation } from "./price-observations/route";
import { POST as postYieldObservation } from "./yield-observations/route";

const { getAuthSession, requireSuperAdminSession, assertKnowledgeWriteAccess, createPriceObservation, createYieldObservation } = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  requireSuperAdminSession: vi.fn(),
  assertKnowledgeWriteAccess: vi.fn(),
  createPriceObservation: vi.fn(),
  createYieldObservation: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireSuperAdminSession }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeWriteAccess }));
vi.mock("@/lib/knowledge/observations", () => ({ createPriceObservation, createYieldObservation }));

const globalPriceBody = {
  resourceId: "global-resource",
  value: "12.50",
  unit: "kg",
  scope: "GLOBAL",
  sourceId: "company-source",
  observedAt: "2026-09-09T00:00:00.000Z",
  confidence: "HIGH",
};

const globalYieldBody = {
  canonicalItemId: "global-item",
  value: "1.25",
  unit: "m2",
  scope: "GLOBAL",
  sourceId: "company-source",
  observedAt: "2026-09-09T00:00:00.000Z",
  confidence: "HIGH",
};

describe("GLOBAL knowledge observation authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAuthSession.mockResolvedValue({ user: { id: "admin-1", activeCompanyId: "company-a" } });
    requireSuperAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("forwards GLOBAL authorization to the canonical resource check", async () => {
    createPriceObservation.mockResolvedValue({ id: "price-1" });

    const response = await postPriceObservation(new Request("http://localhost", { method: "POST", body: JSON.stringify(globalPriceBody) }));

    expect(response.status).toBe(201);
    expect(assertKnowledgeWriteAccess).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "CanonicalResource",
      entityId: "global-resource",
      scope: "GLOBAL",
      capability: "knowledge.manage",
    }));
  });

  it("forwards GLOBAL authorization to the canonical item check", async () => {
    createYieldObservation.mockResolvedValue({ id: "yield-1" });

    const response = await postYieldObservation(new Request("http://localhost", { method: "POST", body: JSON.stringify(globalYieldBody) }));

    expect(response.status).toBe(201);
    expect(assertKnowledgeWriteAccess).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "CanonicalItem",
      entityId: "global-item",
      scope: "GLOBAL",
      capability: "knowledge.manage",
    }));
  });
});
