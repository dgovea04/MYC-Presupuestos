import { describe, expect, it } from "vitest";

import { createSqlServerRestoreTargetFiles, parseSqlServerDefaultPaths } from "@/lib/s10/sqlserver-local";

describe("parseSqlServerDefaultPaths", () => {
  it("uses SQL Server data and log paths from sqlcmd rows", () => {
    expect(parseSqlServerDefaultPaths([["C:\\SqlData\\", "C:\\SqlLog\\"]])).toEqual({
      dataPath: "C:\\SqlData\\",
      logPath: "C:\\SqlLog\\",
    });
  });

  it("falls back to the data path when the log path is missing", () => {
    expect(parseSqlServerDefaultPaths([["C:\\SqlData\\", ""]])).toEqual({
      dataPath: "C:\\SqlData\\",
      logPath: "C:\\SqlData\\",
    });
  });
});

describe("createSqlServerRestoreTargetFiles", () => {
  it("creates stable data and log target paths for restored backup files", () => {
    expect(
      createSqlServerRestoreTargetFiles({
        databaseName: "S10 OBRA/MYC",
        dataPath: "C:\\SqlData",
        logPath: "C:\\SqlLog",
        files: [
          { logicalName: "S10_Data", type: "data" },
          { logicalName: "S10_Datos", type: "data" },
          { logicalName: "S10_Log", type: "log" },
        ],
      }),
    ).toEqual([
      { logicalName: "S10_Data", type: "data", targetPath: "C:\\SqlData\\S10_OBRA_MYC.mdf" },
      { logicalName: "S10_Datos", type: "data", targetPath: "C:\\SqlData\\S10_OBRA_MYC_1.ndf" },
      { logicalName: "S10_Log", type: "log", targetPath: "C:\\SqlLog\\S10_OBRA_MYC_log.ldf" },
    ]);
  });
});
