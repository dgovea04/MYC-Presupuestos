import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";

const sourcePath = join(process.cwd(), "presupuesto-ejemplo", "mcp", "test-completo-exportar.mcp");
const targetPath = join(process.cwd(), "data-for-seed", "demo-projects", "edificio-multifamiliar-demo.mcp");

const sourceBuffer = readFileSync(sourcePath);
const analysis = analyzeProjectPackageBuffer(sourceBuffer);

if (analysis.preview.compatibility === "unsupported") {
  throw new Error(`Demo MCP incompatible: ${analysis.preview.errors.join(", ")}`);
}

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, sourceBuffer);

console.log(`Demo MCP copied to ${targetPath}`);
console.log(`Source project: ${analysis.manifest.project.name}`);
console.log(`Modules: ${analysis.manifest.modules.map((module) => module.id).join(", ")}`);
