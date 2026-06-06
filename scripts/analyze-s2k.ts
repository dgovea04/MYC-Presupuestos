import fs from "node:fs";
import path from "node:path";

import { analyzeS2kBuffer } from "@/lib/s10/s2k-analyzer";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Uso: npm.cmd run s10:analyze -- ruta\\obra.s2k");
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
const buffer = fs.readFileSync(resolvedPath);
const analysis = analyzeS2kBuffer(buffer);

console.log(`Archivo: ${resolvedPath}`);
console.log(`Tamano: ${analysis.sizeBytes} bytes`);
console.log(`Tipo probable: ${analysis.detectedKind}`);
console.log(`Firma: ${analysis.signature || "(sin firma reconocible)"}`);
console.log("");
console.log("Primeros bytes (hex):");
console.log(analysis.hexPreview);
console.log("");
console.log("Vista ASCII:");
console.log(analysis.asciiPreview);
console.log("");
console.log("Siguiente paso:");
console.log(analysis.recommendedAction);
