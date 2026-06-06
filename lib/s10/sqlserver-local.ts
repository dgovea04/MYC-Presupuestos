import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildS10BudgetListSql,
  buildS10DatabaseProbeSql,
  buildSqlServerDatabaseListSql,
  createS10DatabaseCandidate,
  extractJsonObjectFromSqlcmdOutput,
  parseS10BudgetSummaries,
  parseSqlcmdTsv,
  parseSqlServerDatabaseNames,
  prepareS10SnapshotExportSql,
  type S10BudgetSummary,
  type S10DatabaseCandidate,
} from "@/lib/s10/sqlserver-inspector";

export type S10LocalSqlServerOptions = {
  server: string;
  user?: string;
  password?: string;
  trustServerCertificate?: boolean;
};

export type S10LocalSnapshotExportOptions = S10LocalSqlServerOptions & {
  databaseName: string;
  budgetCode: string;
};

export function isS10LocalSqlServerEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.MYC_ENABLE_LOCAL_S10_SQLSERVER === "true";
}

export function listLocalS10Databases(options: S10LocalSqlServerOptions): S10DatabaseCandidate[] {
  const databaseRows = runSqlcmdQuery(options, buildSqlServerDatabaseListSql());
  const databaseNames = parseSqlServerDatabaseNames(databaseRows);
  const candidates: S10DatabaseCandidate[] = [];

  for (const databaseName of databaseNames) {
    const probeRows = runSqlcmdQuery(options, buildS10DatabaseProbeSql(databaseName));
    const candidate = createS10DatabaseCandidate(databaseName, probeRows);
    if (candidate.isS10Candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function listLocalS10Budgets(options: S10LocalSqlServerOptions & { databaseName: string }): S10BudgetSummary[] {
  const rows = runSqlcmdQuery(options, buildS10BudgetListSql(options.databaseName));
  return parseS10BudgetSummaries(rows);
}

export function exportLocalS10Snapshot(options: S10LocalSnapshotExportOptions) {
  const templatePath = path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "sql", "export-s10-snapshot.sql");
  const templateSql = fs.readFileSync(templatePath, "utf8");
  const exportSql = prepareS10SnapshotExportSql(templateSql, options.budgetCode);
  const timestamp = Date.now();
  const tempSqlPath = path.join(os.tmpdir(), `myc-s10-export-${timestamp}.sql`);
  const tempOutputPath = path.join(os.tmpdir(), `myc-s10-export-${timestamp}.txt`);

  fs.writeFileSync(tempSqlPath, exportSql, "utf8");

  try {
    runSqlcmdFile(options, tempSqlPath, tempOutputPath);
    return extractJsonObjectFromSqlcmdOutput(fs.readFileSync(tempOutputPath, "utf8"));
  } finally {
    fs.rmSync(tempSqlPath, { force: true });
    fs.rmSync(tempOutputPath, { force: true });
  }
}

function runSqlcmdQuery(options: S10LocalSqlServerOptions, query: string) {
  const output = runSqlcmd([
    ...createConnectionArgs(options),
    "-W",
    "-h",
    "-1",
    "-s",
    "\t",
    "-Q",
    query,
  ]);

  return parseSqlcmdTsv(output);
}

function runSqlcmdFile(options: S10LocalSnapshotExportOptions, filePath: string, outputPath: string) {
  runSqlcmd([
    ...createConnectionArgs(options),
    "-d",
    options.databaseName,
    "-w",
    "65535",
    "-y",
    "0",
    "-Y",
    "0",
    "-i",
    filePath,
    "-o",
    outputPath,
  ]);
}

function createConnectionArgs(options: S10LocalSqlServerOptions) {
  const authArgs = options.user && options.password ? ["-U", options.user, "-P", options.password] : ["-E"];
  const certificateArgs = options.trustServerCertificate ?? true ? ["-C"] : [];

  return ["-S", options.server, ...authArgs, ...certificateArgs];
}

function runSqlcmd(args: string[]) {
  const result = spawnSync(resolveSqlcmdExecutable(), ["-b", ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`No se pudo ejecutar sqlcmd: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error([result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n"));
  }

  return result.stdout;
}

function resolveSqlcmdExecutable() {
  const classicPath = "C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE";
  const installedPath = "C:\\Program Files\\SqlCmd\\sqlcmd.exe";
  if (fs.existsSync(classicPath)) {
    return classicPath;
  }

  return fs.existsSync(installedPath) ? installedPath : "sqlcmd";
}
