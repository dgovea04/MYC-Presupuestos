import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyzeS2kBuffer } from "@/lib/s10/s2k-analyzer";
import { createS10SnapshotContract, serializeS10SnapshotContract } from "@/lib/s10/snapshot-contract";
import { parseS10ExportSnapshotJson } from "@/lib/s10/import-preview";
import {
  buildS10BudgetListSql,
  buildS10DatabaseProbeSql,
  buildSqlServerBackupFileListSql,
  buildSqlServerDatabaseListSql,
  buildSqlServerDefaultPathsSql,
  buildSqlServerRestoreDatabaseSql,
  createS10DatabaseCandidate,
  extractJsonObjectFromSqlcmdOutput,
  parseSqlServerBackupFileListRows,
  parseS10BudgetSummaries,
  parseSqlcmdTsv,
  parseSqlServerDatabaseNames,
  prepareS10SnapshotExportSql,
  type SqlServerBackupFile,
  type SqlServerRestoreTargetFile,
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

export type S10LocalS2kRestoreOptions = S10LocalSqlServerOptions & {
  backupPath: string;
  databaseName: string;
  replaceExisting?: boolean;
};

export type SqlServerDefaultPaths = {
  dataPath: string;
  logPath: string;
};

export type SqlServerRestoreTargetFilesInput = SqlServerDefaultPaths & {
  databaseName: string;
  files: SqlServerBackupFile[];
};

export type S10LocalS2kRestoreResult = {
  database: S10DatabaseCandidate;
  files: SqlServerRestoreTargetFile[];
  backupPath: string;
};

const s2kBackupHeaderBytes = 4096;

export function isS10LocalSqlServerEnabled() {
  return process.env.NODE_ENV === "development";
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
    const legacyJson = extractJsonObjectFromSqlcmdOutput(fs.readFileSync(tempOutputPath, "utf8"));
    const snapshot = parseS10ExportSnapshotJson(legacyJson);
    return serializeS10SnapshotContract(
      createS10SnapshotContract(snapshot, {
        adapter: "sqlserver",
        databaseName: options.databaseName,
        budgetCode: options.budgetCode,
      }),
    );
  } finally {
    fs.rmSync(tempSqlPath, { force: true });
    fs.rmSync(tempOutputPath, { force: true });
  }
}

export function restoreLocalS10Backup(options: S10LocalS2kRestoreOptions): S10LocalS2kRestoreResult {
  const backupPath = path.resolve(options.backupPath);
  assertReadableS10Backup(backupPath);

  const fileListRows = runSqlcmdQuery(options, buildSqlServerBackupFileListSql(backupPath));
  const backupFiles = parseSqlServerBackupFileListRows(fileListRows);
  if (backupFiles.length === 0) {
    throw new Error("El backup S10 no contiene archivos restaurables.");
  }

  const defaultPaths = parseSqlServerDefaultPaths(runSqlcmdQuery(options, buildSqlServerDefaultPathsSql()));
  const targetFiles = createSqlServerRestoreTargetFiles({
    databaseName: options.databaseName,
    dataPath: defaultPaths.dataPath,
    logPath: defaultPaths.logPath,
    files: backupFiles,
  });

  runSqlcmdQuery(
    options,
    buildSqlServerRestoreDatabaseSql({
      backupPath,
      databaseName: options.databaseName,
      files: targetFiles,
      replaceExisting: options.replaceExisting ?? false,
    }),
  );

  const probeRows = runSqlcmdQuery(options, buildS10DatabaseProbeSql(options.databaseName));
  const database = createS10DatabaseCandidate(options.databaseName, probeRows);
  if (!database.isS10Candidate) {
    throw new Error("La base restaurada no tiene la estructura esperada de S10.");
  }

  return {
    database,
    files: targetFiles,
    backupPath,
  };
}

export function parseSqlServerDefaultPaths(rows: string[][]): SqlServerDefaultPaths {
  const dataPath = normalizeSqlServerDirectory(rows[0]?.[0] ?? "");
  const logPath = normalizeSqlServerDirectory(rows[0]?.[1] ?? "") || dataPath;

  if (!dataPath) {
    throw new Error("No se pudo detectar la carpeta de datos por defecto de SQL Server.");
  }

  return { dataPath, logPath };
}

export function createSqlServerRestoreTargetFiles(input: SqlServerRestoreTargetFilesInput): SqlServerRestoreTargetFile[] {
  const safeDatabaseName = sanitizeSqlServerFileName(input.databaseName);
  let dataIndex = 0;
  let logIndex = 0;

  return input.files.map((file) => {
    if (file.type === "log") {
      const suffix = logIndex === 0 ? "_log" : `_log_${logIndex}`;
      logIndex += 1;
      return {
        ...file,
        targetPath: path.join(input.logPath, `${safeDatabaseName}${suffix}.ldf`),
      };
    }

    const suffix = dataIndex === 0 ? "" : `_${dataIndex}`;
    const extension = dataIndex === 0 ? ".mdf" : ".ndf";
    dataIndex += 1;
    return {
      ...file,
      targetPath: path.join(input.dataPath, `${safeDatabaseName}${suffix}${extension}`),
    };
  });
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
  if (fs.existsSync(installedPath)) {
    return installedPath;
  }

  return fs.existsSync(classicPath) ? classicPath : "sqlcmd";
}

function assertReadableS10Backup(backupPath: string) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`No existe el archivo S10: ${backupPath}`);
  }

  const stats = fs.statSync(backupPath);
  if (!stats.isFile()) {
    throw new Error(`La ruta S10 no es un archivo: ${backupPath}`);
  }

  const header = readFileHeader(backupPath, s2kBackupHeaderBytes);
  const analysis = analyzeS2kBuffer(header, s2kBackupHeaderBytes, stats.size);
  if (analysis.detectedKind !== "sql-server-backup") {
    throw new Error(`El archivo no parece un backup SQL Server S10. Tipo detectado: ${analysis.detectedKind}.`);
  }
}

function readFileHeader(filePath: string, byteCount: number) {
  const file = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(byteCount);
    const bytesRead = fs.readSync(file, buffer, 0, byteCount, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(file);
  }
}

function normalizeSqlServerDirectory(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.toUpperCase() === "NULL" ? "" : trimmed;
}

function sanitizeSqlServerFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "S10_RESTORE";
}
