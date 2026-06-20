import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/s10/sqlserver-local", () => ({
  isS10LocalSqlServerEnabled: vi.fn(),
  listLocalS10Budgets: vi.fn(),
}));

import { GET } from "@/app/api/imports/s10/sqlserver/budgets/route";
import { getAuthSession } from "@/lib/auth/session";
import { isS10LocalSqlServerEnabled, listLocalS10Budgets } from "@/lib/s10/sqlserver-local";

describe("S10 SQL Server budgets route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isS10LocalSqlServerEnabled).mockReturnValue(true);
  });

  it("requires a database", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await GET(new Request("http://localhost/api/imports/s10/sqlserver/budgets"));

    expect(response.status).toBe(400);
  });

  it("returns budgets from the selected database", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(listLocalS10Budgets).mockReturnValue([
      {
        code: "0302044",
        description: "I.E. MARIANO MELGAR - CONSOLIDADO",
        totalCost: 13430851.89,
        subBudgetCount: 4,
        itemCount: 371,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/imports/s10/sqlserver/budgets?database=S10_OBRA_MYC&server=.\\SQLEXPRESS"),
    );

    expect(response.status).toBe(200);
    expect(listLocalS10Budgets).toHaveBeenCalledWith({
      server: ".\\SQLEXPRESS",
      databaseName: "S10_OBRA_MYC",
      user: undefined,
      password: undefined,
      trustServerCertificate: true,
    });
    await expect(response.json()).resolves.toMatchObject({ budgets: [{ code: "0302044" }] });
  });
});
