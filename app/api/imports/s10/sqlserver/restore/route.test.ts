import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  isS10LocalSqlServerEnabled: vi.fn(),
  restoreLocalS10Backup: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/s10/sqlserver-local", () => ({
  isS10LocalSqlServerEnabled: mocks.isS10LocalSqlServerEnabled,
  restoreLocalS10Backup: mocks.restoreLocalS10Backup,
}));

import { POST } from "@/app/api/imports/s10/sqlserver/restore/route";

describe("S10 SQL Server restore route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.isS10LocalSqlServerEnabled.mockReturnValue(true);
    mocks.restoreLocalS10Backup.mockReturnValue({
      backupPath: "C:\\MYC-Presupuestos\\presupuesto-ejemplo\\obra.S2K",
      database: {
        databaseName: "S10_OBRA_MYC",
        isS10Candidate: true,
        matchedTables: ["Presupuesto", "Subpresupuesto", "Partida"],
        presupuestoCount: 1,
      },
      files: [{ logicalName: "S10_Data", type: "data", targetPath: "C:\\SqlData\\S10_OBRA_MYC.mdf" }],
    });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/imports/s10/sqlserver/restore", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
  });

  it("restores a local S2K backup into SQL Server", async () => {
    const response = await POST(
      new Request("http://localhost/api/imports/s10/sqlserver/restore", {
        method: "POST",
        body: JSON.stringify({
          server: ".\\SQLEXPRESS",
          backupPath: "presupuesto-ejemplo\\obra.S2K",
          databaseName: "S10_OBRA_MYC",
          replaceExisting: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.restoreLocalS10Backup).toHaveBeenCalledWith({
      server: ".\\SQLEXPRESS",
      backupPath: "presupuesto-ejemplo\\obra.S2K",
      databaseName: "S10_OBRA_MYC",
      replaceExisting: true,
      user: undefined,
      password: undefined,
      trustServerCertificate: true,
    });
    await expect(response.json()).resolves.toMatchObject({ database: { databaseName: "S10_OBRA_MYC" } });
  });

  it("restores an uploaded S2K backup through a temporary local file", async () => {
    const formData = new FormData();
    formData.set("server", ".\\SQLEXPRESS");
    formData.set("databaseName", "S10_OBRA_UPLOAD");
    formData.set("file", new File([Buffer.from("TAPE\u0000\u0000\u0003\u0000")], "obra.S2K"));

    const response = await POST(
      new Request("http://localhost/api/imports/s10/sqlserver/restore", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.restoreLocalS10Backup).toHaveBeenCalledWith(
      expect.objectContaining({
        server: ".\\SQLEXPRESS",
        databaseName: "S10_OBRA_UPLOAD",
        replaceExisting: false,
      }),
    );
    expect(mocks.restoreLocalS10Backup.mock.calls[0]?.[0].backupPath).toContain("obra.S2K");
  });

  it("requires a backup path and database name", async () => {
    const response = await POST(
      new Request("http://localhost/api/imports/s10/sqlserver/restore", {
        method: "POST",
        body: JSON.stringify({ server: ".\\SQLEXPRESS" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Falta backupPath." });
  });
});
