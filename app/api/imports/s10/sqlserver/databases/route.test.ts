import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/s10/sqlserver-local", () => ({
  isS10LocalSqlServerEnabled: vi.fn(),
  listLocalS10Databases: vi.fn(),
}));

import { GET } from "@/app/api/imports/s10/sqlserver/databases/route";
import { getAuthSession } from "@/lib/auth/session";
import { isS10LocalSqlServerEnabled, listLocalS10Databases } from "@/lib/s10/sqlserver-local";

describe("S10 SQL Server databases route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isS10LocalSqlServerEnabled).mockReturnValue(true);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/imports/s10/sqlserver/databases"));

    expect(response.status).toBe(401);
  });

  it("rejects when local SQL Server imports are disabled", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(isS10LocalSqlServerEnabled).mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/imports/s10/sqlserver/databases"));

    expect(response.status).toBe(403);
  });

  it("returns S10 database candidates", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(listLocalS10Databases).mockReturnValue([
      {
        databaseName: "S10_OBRA_MYC",
        isS10Candidate: true,
        matchedTables: ["Presupuesto", "Subpresupuesto", "SubpresupuestoDetalle", "Partida"],
        presupuestoCount: 9,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/imports/s10/sqlserver/databases?server=np%3A%5C%5C.%5Cpipe%5CSQLLocal%5CSQLEXPRESS"),
    );

    expect(response.status).toBe(200);
    expect(listLocalS10Databases).toHaveBeenCalledWith({
      server: "np:\\\\.\\pipe\\SQLLocal\\SQLEXPRESS",
      user: undefined,
      password: undefined,
      trustServerCertificate: true,
    });
    await expect(response.json()).resolves.toMatchObject({ databases: [{ databaseName: "S10_OBRA_MYC" }] });
  });
});
