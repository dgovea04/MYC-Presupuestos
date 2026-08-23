import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  createS10ImportDraftPreview: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/s10/import-preview", () => ({
  createS10ImportDraftPreview: mocks.createS10ImportDraftPreview,
}));

import { POST } from "@/app/api/imports/delphin/draft/route";
import { createS10SnapshotContract } from "@/lib/s10/snapshot-contract";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const snapshot: S10ExportSnapshot = {
  presupuestos: [{ CodPresupuesto: "DELPHIN", Descripcion: "Carreteras", Moneda: "S/.", CostoOferta1: 100 }],
  subpresupuestos: [],
  partidas: [],
  apuDetalles: [],
};

describe("POST /api/imports/delphin/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.createS10ImportDraftPreview.mockReturnValue({ projectName: "Carreteras", budgets: [], warnings: [] });
  });

  it("unwraps a versioned SQLite snapshot before creating the preview", async () => {
    const contract = createS10SnapshotContract(snapshot, { adapter: "legacy" });

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: contract, companyId: "company-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createS10ImportDraftPreview).toHaveBeenCalledWith(snapshot, {
      companyId: "company-1",
      sourceSystem: "DELPHIN",
    });
  });
});
