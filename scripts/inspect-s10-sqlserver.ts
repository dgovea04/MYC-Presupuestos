import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { analyzeS2kBuffer } from "@/lib/s10/s2k-analyzer";
import {
  buildS10SchemaInspectionSql,
  buildSqlcmdArgs,
  buildSqlServerBackupFileListSql,
  buildSqlServerBackupHeaderSql,
  createS10SchemaManifest,
  parseSqlcmdTsv,
} from "@/lib/s10/sqlserver-inspector";

type InspectMode = "filelist" | "header" | "schema";

type CliOptions = {
  backupPath?: string;
  databaseName?: string;
  server?: string;
  user?: string;
  password?: string;
  outputPath?: string;
  mode: InspectMode;
  trustServerCertificate: boolean;
};

const options = parseCliOptions(process.argv.slice(2));

if (!options.server) {
  fail("Falta --server. Ejemplo: --server localhost\\SQLEXPRESS");
}

if ((options.mode === "filelist" || options.mode === "header") && !options.backupPath) {
  fail("Falta --backup para inspeccionar el archivo .S2K.");
}

if (options.mode === "schema" && !options.databaseName) {
  fail("Falta --database para inspeccionar una base S10 restaurada.");
}

if (options.backupPath) {
  assertSqlServerBackup(options.backupPath);
}

const query = createInspectionQuery(options);
const args = buildSqlcmdArgs({
  server: options.server,
  user: options.user,
  password: options.password,
  trustServerCertificate: options.trustServerCertificate,
  query,
});
const result = spawnSync(resolveSqlcmdExecutable(), args, { encoding: "utf8" });

if (result.error) {
  fail(`No se pudo ejecutar sqlcmd: ${result.error.message}`);
}

if (result.status !== 0) {
  fail([result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n"));
}

if (options.mode !== "schema") {
  console.log(result.stdout.trim());
  process.exit(0);
}

const manifest = createS10SchemaManifest(parseSqlcmdTsv(result.stdout));
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

if (options.outputPath) {
  const resolvedOutputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, manifestJson, "utf8");
  console.log(`Manifiesto S10 escrito en ${resolvedOutputPath}`);
} else {
  console.log(manifestJson);
}

function createInspectionQuery(cliOptions: CliOptions) {
  const resolvedBackupPath = cliOptions.backupPath ? path.resolve(cliOptions.backupPath) : "";

  if (cliOptions.mode === "schema") {
    return buildS10SchemaInspectionSql(cliOptions.databaseName ?? "");
  }

  if (cliOptions.mode === "header") {
    return buildSqlServerBackupHeaderSql(resolvedBackupPath);
  }

  return buildSqlServerBackupFileListSql(resolvedBackupPath);
}

function resolveSqlcmdExecutable() {
  const classicPath = "C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE";
  const installedPath = "C:\\Program Files\\SqlCmd\\sqlcmd.exe";
  if (fs.existsSync(classicPath)) {
    return classicPath;
  }

  return fs.existsSync(installedPath) ? installedPath : "sqlcmd";
}

function assertSqlServerBackup(backupPath: string) {
  const resolvedPath = path.resolve(backupPath);
  const analysis = analyzeS2kBuffer(fs.readFileSync(resolvedPath));

  if (analysis.detectedKind !== "sql-server-backup") {
    fail(`El archivo no parece un backup SQL Server. Tipo detectado: ${analysis.detectedKind}.`);
  }
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    mode: "filelist",
    trustServerCertificate: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const value = args[index + 1];

    if (token === "--backup") {
      options.backupPath = requireValue(token, value);
      index += 1;
    } else if (token === "--database") {
      options.databaseName = requireValue(token, value);
      options.mode = "schema";
      index += 1;
    } else if (token === "--server") {
      options.server = requireValue(token, value);
      index += 1;
    } else if (token === "--user") {
      options.user = requireValue(token, value);
      index += 1;
    } else if (token === "--password") {
      options.password = requireValue(token, value);
      index += 1;
    } else if (token === "--out") {
      options.outputPath = requireValue(token, value);
      index += 1;
    } else if (token === "--filelist") {
      options.mode = "filelist";
    } else if (token === "--header") {
      options.mode = "header";
    } else if (token === "--schema") {
      options.mode = "schema";
    } else if (token === "--trust-server-certificate") {
      options.trustServerCertificate = true;
    } else if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    } else {
      fail(`Opcion no reconocida: ${token}`);
    }
  }

  return options;
}

function requireValue(token: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    fail(`Falta valor para ${token}.`);
  }

  return value;
}

function fail(message: string): never {
  console.error(message);
  console.error("");
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.error("Uso:");
  console.error("  npm.cmd run s10:inspect -- --server localhost\\SQLEXPRESS --backup presupuesto-ejemplo\\obra.S2K --filelist");
  console.error("  npm.cmd run s10:inspect -- --server localhost\\SQLEXPRESS --backup presupuesto-ejemplo\\obra.S2K --header");
  console.error("  npm.cmd run s10:inspect -- --server localhost\\SQLEXPRESS --database S10_OBRA --schema --out data-for-seed\\s10-schema.json");
  console.error("");
  console.error("Autenticacion:");
  console.error("  Por defecto usa seguridad integrada de Windows. Para SQL auth agrega --user sa --password <clave>.");
}
