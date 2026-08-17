import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSuperAdminSessionMock, parseWorkbookMock, createBatchMock } = vi.hoisted(() => ({
  requireSuperAdminSessionMock: vi.fn(),
  parseWorkbookMock: vi.fn(),
  createBatchMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireSuperAdminSession: requireSuperAdminSessionMock }));
vi.mock("@/lib/local-resource-pricing/parser", () => ({ parseLocalResourcePriceWorkbook: parseWorkbookMock }));
vi.mock("@/lib/local-resource-pricing/service", () => ({ createLocalResourcePriceBatch: createBatchMock }));

import { POST } from "@/app/api/admin/resource-prices/local/import/route";

describe("local resource price import route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-super-admin imports", async () => {
    requireSuperAdminSessionMock.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost", { method: "POST", body: new FormData() }));
    expect(response.status).toBe(403);
  });

  it("returns 200 and reuses the existing preview for a repeated file hash", async () => {
    requireSuperAdminSessionMock.mockResolvedValue({ user: { id: "super-admin-1" } });
    parseWorkbookMock.mockResolvedValue({ rows: [{ code: "MAT-1", description: "Cemento", unit: "bol", currency: "PEN", proposedPrice: "25" }], fileHash: "hash-1", worksheetName: "Precios" });
    createBatchMock.mockResolvedValue({ batch: { id: "batch-1", versionLabel: "20260818-001" }, items: [], reused: true });
    const formData = new FormData();
    formData.set("file", new File(["xlsx"], "precios.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }));
    expect(response.status).toBe(200);
    expect(createBatchMock).toHaveBeenCalledWith(expect.objectContaining({ source: "EXCEL", fileHash: "hash-1", fileName: "precios.xlsx" }));
    expect((await response.json()).reused).toBe(true);
  });
});
