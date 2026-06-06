import { describe, expect, it } from "vitest";

import {
  buildS10BudgetListSql,
  buildS10DatabaseProbeSql,
  buildSqlcmdArgs,
  buildS10SchemaInspectionSql,
  buildSqlServerDatabaseListSql,
  buildSqlServerBackupFileListSql,
  createS10DatabaseCandidate,
  createS10SchemaManifest,
  extractJsonObjectFromSqlcmdOutput,
  parseS10BudgetSummaries,
  parseSqlServerDatabaseNames,
  parseSqlcmdTsv,
  prepareS10SnapshotExportSql,
} from "@/lib/s10/sqlserver-inspector";

describe("buildSqlcmdArgs", () => {
  it("uses integrated security by default and requests tab-separated output", () => {
    expect(buildSqlcmdArgs({ server: "localhost", query: "SELECT 1" })).toEqual([
      "-S",
      "localhost",
      "-E",
      "-b",
      "-W",
      "-h",
      "-1",
      "-s",
      "\t",
      "-Q",
      "SELECT 1",
    ]);
  });

  it("uses SQL credentials when user and password are provided", () => {
    expect(buildSqlcmdArgs({ server: ".\\SQLEXPRESS", user: "sa", password: "secret", query: "SELECT 1" })).toContain(
      "-U",
    );
  });
});

describe("buildSqlServerBackupFileListSql", () => {
  it("escapes backup paths for RESTORE FILELISTONLY", () => {
    expect(buildSqlServerBackupFileListSql("C:\\S10\\obra's.s2k")).toBe(
      "RESTORE FILELISTONLY FROM DISK = N'C:\\S10\\obra''s.s2k';",
    );
  });
});

describe("buildSqlServerDatabaseListSql", () => {
  it("lists accessible online user databases", () => {
    const sql = buildSqlServerDatabaseListSql();

    expect(sql).toContain("FROM sys.databases");
    expect(sql).toContain("state_desc = 'ONLINE'");
    expect(sql).toContain("HAS_DBACCESS(name) = 1");
  });
});

describe("buildS10DatabaseProbeSql", () => {
  it("checks required S10 tables inside the selected database", () => {
    const sql = buildS10DatabaseProbeSql("S10_OBRA]");

    expect(sql).toContain("USE [S10_OBRA]]];");
    expect(sql).toContain("N'Presupuesto'");
    expect(sql).toContain("OBJECT_ID(N'dbo.' + required.name");
  });
});

describe("buildS10BudgetListSql", () => {
  it("lists budgets from the selected S10 database", () => {
    const sql = buildS10BudgetListSql("S10_OBRA");

    expect(sql).toContain("USE [S10_OBRA];");
    expect(sql).toContain("FROM dbo.Presupuesto");
    expect(sql).toContain("INNER JOIN dbo.SubpresupuestoDetalle");
    expect(sql).toContain("COUNT(spd.CodPartida)");
    expect(sql).toContain("CodPresupuesto");
  });
});

describe("buildS10SchemaInspectionSql", () => {
  it("targets the selected database and emits stable tab-separated result sets", () => {
    const sql = buildS10SchemaInspectionSql("S10_OBRA");

    expect(sql).toContain("USE [S10_OBRA];");
    expect(sql).toContain("'TABLES' AS result_set");
    expect(sql).toContain("'COLUMNS' AS result_set");
    expect(sql).toContain("sys.tables");
  });
});

describe("parseSqlcmdTsv", () => {
  it("parses sqlcmd tab-separated output and ignores row count noise", () => {
    const rows = parseSqlcmdTsv("Changed database context to 'S10_OBRA'.\r\nTABLES\tdbo\tPartidas\t42\r\n\r\n(1 rows affected)\r\n");

    expect(rows).toEqual([["TABLES", "dbo", "Partidas", "42"]]);
  });
});

describe("parseSqlServerDatabaseNames", () => {
  it("returns the first column from sqlcmd rows", () => {
    expect(parseSqlServerDatabaseNames([["S10_OBRA"], ["master"]])).toEqual(["S10_OBRA", "master"]);
  });
});

describe("createS10DatabaseCandidate", () => {
  it("marks databases with core S10 tables as candidates", () => {
    const candidate = createS10DatabaseCandidate("S10_OBRA", [
      ["S10_OBRA", "Partida", "2"],
      ["S10_OBRA", "Presupuesto", "2"],
      ["S10_OBRA", "Subpresupuesto", "2"],
      ["S10_OBRA", "SubpresupuestoDetalle", "2"],
    ]);

    expect(candidate).toEqual({
      databaseName: "S10_OBRA",
      isS10Candidate: true,
      matchedTables: ["Partida", "Presupuesto", "Subpresupuesto", "SubpresupuestoDetalle"],
      presupuestoCount: 2,
    });
  });
});

describe("parseS10BudgetSummaries", () => {
  it("parses budget rows from sqlcmd", () => {
    expect(parseS10BudgetSummaries([["0302044", "I.E. MARIANO MELGAR", "123.45", "4", "371"]])).toEqual([
      { code: "0302044", description: "I.E. MARIANO MELGAR", totalCost: 123.45, subBudgetCount: 4, itemCount: 371 },
    ]);
  });
});

describe("prepareS10SnapshotExportSql", () => {
  it("removes the hard-coded database and replaces the budget code", () => {
    const sql = prepareS10SnapshotExportSql(
      "USE S10_OBRA_MYC;\nGO\n\nDECLARE @CodPresupuesto varchar(20) = '0201003';\nSELECT 1;",
      "03'02",
    );

    expect(sql).not.toContain("USE S10_OBRA_MYC");
    expect(sql).toContain("DECLARE @CodPresupuesto varchar(20) = '03''02';");
  });
});

describe("extractJsonObjectFromSqlcmdOutput", () => {
  it("extracts a compact JSON object from noisy sqlcmd output", () => {
    expect(extractJsonObjectFromSqlcmdOutput("noise\r\n{\r\n  \"ok\": true\r\n}\r\n(1 rows affected)")).toBe(
      '{  "ok": true}',
    );
  });
});

describe("createS10SchemaManifest", () => {
  it("groups columns under tables and marks likely S10 domains", () => {
    const manifest = createS10SchemaManifest([
      ["TABLES", "dbo", "Partidas", "42"],
      ["TABLES", "dbo", "Insumos", "12"],
      ["COLUMNS", "dbo", "Partidas", "CodPartida", "varchar", "20", "0", "0", "NO", "1"],
      ["COLUMNS", "dbo", "Partidas", "Descripcion", "nvarchar", "200", "0", "0", "YES", "2"],
      ["COLUMNS", "dbo", "Insumos", "Precio", "decimal", "0", "18", "4", "NO", "1"],
    ]);

    const partidas = manifest.tables.find((table) => table.name === "Partidas");

    expect(manifest.tables).toHaveLength(2);
    expect(partidas).toMatchObject({
      schema: "dbo",
      name: "Partidas",
      rowCount: 42,
      likelyDomain: "partidas",
    });
    expect(partidas?.columns).toHaveLength(2);
    expect(manifest.domainCandidates.partidas).toEqual(["dbo.Partidas"]);
    expect(manifest.domainCandidates.resources).toEqual(["dbo.Insumos"]);
  });
});
