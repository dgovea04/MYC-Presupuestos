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
  type S10DatabaseCandidate,
} from "@/lib/s10/sqlserver-inspector";

type CliMode = "list-databases" | "list-budgets" | "export";

type CliOptions = {
  mode?: CliMode;
  server: string;
  databaseName?: string;
  budgetCode?: string;
  outputPath?: string;
  user?: string;
  password?: string;
  trustServerCertificate: boolean;
};

const options = parseCliOptions(process.argv.slice(2));

if (!options.mode) {
  fail("Falta modo. Usa --list-databases, --list-budgets o --export.");
}

if ((options.mode === "list-budgets" || options.mode === "export") && !options.databaseName) {
  fail("Falta --database.");
}

if (options.mode === "export" && !options.budgetCode) {
  fail("Falta --budget.");
}

if (options.mode === "list-databases") {
  listDatabases(options);
} else if (options.mode === "list-budgets") {
  listBudgets(options);
} else {
  exportSnapshot(options);
}

function listDatabases(cliOptions: CliOptions) {
  const rows = runSqlcmdQuery(cliOptions, buildSqlServerDatabaseListSql());
  const databaseNames = parseSqlServerDatabaseNames(rows);
  const candidates: S10DatabaseCandidate[] = [];

  for (const databaseName of databaseNames) {
    const probeRows = runSqlcmdQuery(cliOptions, buildS10DatabaseProbeSql(databaseName));
    const candidate = createS10DatabaseCandidate(databaseName, probeRows);
    if (candidate.isS10Candidate) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    console.log("No se encontraron bases con estructura S10 accesible.");
    return;
  }

  console.log("Bases S10 candidatas:");
  for (const candidate of candidates) {
    console.log(
      `- ${candidate.databaseName} (${candidate.presupuestoCount} presupuestos, tablas: ${candidate.matchedTables.join(", ")})`,
    );
  }
}

function listBudgets(cliOptions: CliOptions) {
  const rows = runSqlcmdQuery(cliOptions, buildS10BudgetListSql(cliOptions.databaseName ?? ""));
  const budgets = parseS10BudgetSummaries(rows);

  if (budgets.length === 0) {
    console.log("No se encontraron presupuestos en la base seleccionada.");
    return;
  }

  console.log(`Presupuestos en ${cliOptions.databaseName}:`);
  for (const budget of budgets) {
    const total = budget.totalCost === null ? "sin total" : budget.totalCost.toFixed(2);
    console.log(`- ${budget.code}\t${budget.description}\t${budget.subBudgetCount} subpresupuestos\t${budget.itemCount} partidas\t${total}`);
  }
}

function exportSnapshot(cliOptions: CliOptions) {
  const templatePath = path.resolve("scripts", "sql", "export-s10-snapshot.sql");
  const templateSql = fs.readFileSync(templatePath, "utf8");
  const exportSql = prepareS10SnapshotExportSql(templateSql, cliOptions.budgetCode ?? "");
  const tempSqlPath = path.join(os.tmpdir(), `myc-s10-export-${Date.now()}.sql`);
  const tempOutputPath = path.join(os.tmpdir(), `myc-s10-export-${Date.now()}.txt`);

  fs.writeFileSync(tempSqlPath, exportSql, "utf8");

  try {
    runSqlcmdFile(cliOptions, tempSqlPath, tempOutputPath);
    const output = fs.readFileSync(tempOutputPath, "utf8");
    const json = `${extractJsonObjectFromSqlcmdOutput(output)}\n`;
    const outputPath = path.resolve(cliOptions.outputPath ?? `data-for-seed/s10-export-${cliOptions.budgetCode}.json`);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
    console.log(`Snapshot S10 exportado en ${outputPath}`);
  } finally {
    fs.rmSync(tempSqlPath, { force: true });
    fs.rmSync(tempOutputPath, { force: true });
  }
}

function runSqlcmdQuery(cliOptions: CliOptions, query: string) {
  const output = runSqlcmd([
    ...createConnectionArgs(cliOptions),
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

function runSqlcmdFile(cliOptions: CliOptions, filePath: string, outputPath: string) {
  runSqlcmd([
    ...createConnectionArgs(cliOptions),
    "-d",
    cliOptions.databaseName ?? "",
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

function createConnectionArgs(cliOptions: CliOptions) {
  const authArgs = cliOptions.user && cliOptions.password ? ["-U", cliOptions.user, "-P", cliOptions.password] : ["-E"];
  const certificateArgs = cliOptions.trustServerCertificate ? ["-C"] : [];

  return ["-S", cliOptions.server, ...authArgs, ...certificateArgs];
}

function runSqlcmd(args: string[]) {
  const result = spawnSync(resolveSqlcmdExecutable(), ["-b", ...args], { encoding: "utf8" });

  if (result.error) {
    fail(`No se pudo ejecutar sqlcmd: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail([result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n"));
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

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    server: ".\\SQLEXPRESS",
    trustServerCertificate: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const value = args[index + 1];

    if (token === "--list-databases") {
      options.mode = "list-databases";
    } else if (token === "--list-budgets") {
      options.mode = "list-budgets";
    } else if (token === "--export") {
      options.mode = "export";
    } else if (token === "--server") {
      options.server = requireValue(token, value);
      index += 1;
    } else if (token === "--database") {
      options.databaseName = requireValue(token, value);
      index += 1;
    } else if (token === "--budget") {
      options.budgetCode = requireValue(token, value);
      index += 1;
    } else if (token === "--out") {
      options.outputPath = requireValue(token, value);
      index += 1;
    } else if (token === "--user") {
      options.user = requireValue(token, value);
      index += 1;
    } else if (token === "--password") {
      options.password = requireValue(token, value);
      index += 1;
    } else if (token === "--no-trust-server-certificate") {
      options.trustServerCertificate = false;
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
  console.error("  npm.cmd run s10:sqlserver -- --list-databases");
  console.error("  npm.cmd run s10:sqlserver -- --list-budgets --database S10_OBRA_MYC");
  console.error("  npm.cmd run s10:sqlserver -- --export --database S10_OBRA_MYC --budget 0302044 --out data-for-seed\\s10-export-0302044.json");
  console.error("");
  console.error("Opciones:");
  console.error("  --server .\\SQLEXPRESS                  Servidor SQL Server. Por defecto usa .\\SQLEXPRESS.");
  console.error("  --user sa --password <clave>            Usa SQL auth; si no, usa seguridad integrada de Windows.");
  console.error("  --no-trust-server-certificate           Desactiva -C si el servidor tiene certificado confiable.");
}
