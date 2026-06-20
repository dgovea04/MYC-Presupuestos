import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/s10/sqlserver-local", () => ({
  exportLocalS10Snapshot: vi.fn(),
  isS10LocalSqlServerEnabled: vi.fn(),
}));

import { POST } from "@/app/api/imports/s10/sqlserver/export/route";
import { getAuthSession } from "@/lib/auth/session";
import { exportLocalS10Snapshot, isS10LocalSqlServerEnabled } from "@/lib/s10/sqlserver-local";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const snapshot: S10ExportSnapshot = {
  presupuestos: [{ CodPresupuesto: "0302044", Descripcion: "OBRA S10" }],
  subpresupuestos: [{ CodPresupuesto: "0302044", CodSubpresupuesto: "001", Descripcion: "ESTRUCTURAS" }],
  partidas: [],
  apuDetalles: [],
};

describe("S10 SQL Server export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isS10LocalSqlServerEnabled).mockReturnValue(true);
  });

  it("requires a valid JSON body", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/imports/s10/sqlserver/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ server: ".\\SQLEXPRESS" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("exports and parses a S10 snapshot", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(exportLocalS10Snapshot).mockReturnValue(JSON.stringify(snapshot));

    const response = await POST(
      new Request("http://localhost/api/imports/s10/sqlserver/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          server: ".\\SQLEXPRESS",
          databaseName: "S10_OBRA_MYC",
          budgetCode: "0302044",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(exportLocalS10Snapshot).toHaveBeenCalledWith({
      server: ".\\SQLEXPRESS",
      databaseName: "S10_OBRA_MYC",
      budgetCode: "0302044",
      user: undefined,
      password: undefined,
      trustServerCertificate: true,
    });
    await expect(response.json()).resolves.toMatchObject({ snapshot: { presupuestos: [{ CodPresupuesto: "0302044" }] } });
  });
});
