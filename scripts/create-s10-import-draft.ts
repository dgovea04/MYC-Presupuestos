import fs from "node:fs";
import path from "node:path";

import { createMycImportDraftFromS10, type S10ExportSnapshot } from "@/lib/s10/import-mapper";
import { parseS10ExportSnapshotJson } from "@/lib/s10/import-preview";

type CliOptions = {
  inputPath?: string;
  outputPath?: string;
  budgetCode?: string;
  companyId?: string;
  projectId?: string;
};

const options = parseCliOptions(process.argv.slice(2));

if (!options.inputPath) {
  fail("Falta --input con el JSON exportado desde S10.");
}

const resolvedInputPath = path.resolve(options.inputPath);
const snapshot = readS10Snapshot(resolvedInputPath);
const draft = createMycImportDraftFromS10(snapshot, {
  budgetCode: options.budgetCode,
  companyId: options.companyId,
  projectId: options.projectId,
});
const draftJson = `${JSON.stringify(draft, null, 2)}\n`;

if (options.outputPath) {
  const resolvedOutputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, draftJson, "utf8");
  console.log(`Draft MYC escrito en ${resolvedOutputPath}`);
} else {
  console.log(draftJson);
}

console.log(`Presupuesto S10: ${draft.sourceBudgetCode}`);
console.log(`Proyecto: ${draft.project.name}`);
console.log(`Recursos: ${draft.resources.length}`);
console.log(`Presupuestos MYC: ${draft.budgets.length}`);
console.log(`Advertencias: ${draft.warnings.length}`);

function readS10Snapshot(filePath: string): S10ExportSnapshot {
  try {
    return parseS10ExportSnapshotJson(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail("El JSON no tiene la estructura esperada: presupuestos, subpresupuestos, partidas y apuDetalles.");
  }
}

function parseCliOptions(args: string[]): CliOptions {
  const parsed: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const value = args[index + 1];

    if (token === "--input") {
      parsed.inputPath = requireValue(token, value);
      index += 1;
    } else if (token === "--out") {
      parsed.outputPath = requireValue(token, value);
      index += 1;
    } else if (token === "--budget") {
      parsed.budgetCode = requireValue(token, value);
      index += 1;
    } else if (token === "--company") {
      parsed.companyId = requireValue(token, value);
      index += 1;
    } else if (token === "--project") {
      parsed.projectId = requireValue(token, value);
      index += 1;
    } else if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    } else {
      fail(`Opcion no reconocida: ${token}`);
    }
  }

  return parsed;
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
  console.error("  npm.cmd run s10:draft -- --input data-for-seed\\s10-export-preview.json --out data-for-seed\\s10-import-draft.json");
  console.error("  npm.cmd run s10:draft -- --input data-for-seed\\s10-export-preview.json --budget 0201003");
}
