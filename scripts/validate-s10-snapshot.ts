import fs from "node:fs";
import path from "node:path";

import { parseS10SnapshotJson, serializeS10SnapshotContract } from "@/lib/s10/snapshot-contract";

type CliOptions = {
  inputPath?: string;
  outputPath?: string;
};

const options = parseCliOptions(process.argv.slice(2));

if (!options.inputPath) {
  fail("Falta --input con el snapshot JSON S10.");
}

const inputPath = path.resolve(options.inputPath);
let parsed: ReturnType<typeof parseS10SnapshotJson>;

try {
  parsed = parseS10SnapshotJson(fs.readFileSync(inputPath, "utf8"));
} catch (error) {
  fail(error instanceof Error ? error.message : "No se pudo validar el snapshot S10.");
}

if (options.outputPath) {
  const outputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serializeS10SnapshotContract(parsed.contract), "utf8");
  console.log(`Snapshot S10 versionado escrito en ${outputPath}`);
}

console.log(`Contrato: ${parsed.contract.schema} ${parsed.contract.contractVersion}`);
console.log(`Origen: S10/${parsed.contract.source.adapter}`);
console.log(`Formato de entrada: ${parsed.wasLegacy ? "legacy (normalizado)" : "versionado"}`);
console.log(`Presupuestos: ${parsed.snapshot.presupuestos.length}`);
console.log(`Subpresupuestos: ${parsed.snapshot.subpresupuestos.length}`);
console.log(`Partidas: ${parsed.snapshot.partidas.length}`);
console.log(`APUs: ${parsed.snapshot.apuDetalles.length}`);

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
  console.error("  npm.cmd run s10:snapshot -- --input data-for-seed\\s10-export-preview.json");
  console.error("  npm.cmd run s10:snapshot -- --input legacy.json --out snapshot-s10.json");
}
