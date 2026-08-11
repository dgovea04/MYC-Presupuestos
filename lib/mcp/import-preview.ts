import type { McpImportPreview, McpManifest } from "./types";
import { validateManifestStructure } from "./schema";
import { validateManifestVersion } from "./manifest";
import { validateChecksums } from "./checksums";
import { extractStoredZip } from "./archive";

const MAX_MCP_FILE_BYTES = 40 * 1024 * 1024; // 40 MB

export type AnalyzeResult = {
  preview: McpImportPreview;
  manifest: McpManifest;
  fileContents: Map<string, string>;
};

export function analyzeProjectPackageBuffer(
  buffer: Buffer | Uint8Array,
): AnalyzeResult {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (buf.byteLength > MAX_MCP_FILE_BYTES) {
    throw new Error("El archivo .mcp supera el limite de 40 MB para importacion.");
  }

  if (buf.byteLength < 22) {
    throw new Error("El archivo .mcp es demasiado pequeno para ser un paquete valido.");
  }

  const fileContents = extractStoredZip(buf);

  if (fileContents.size === 0) {
    throw new Error("El archivo .mcp es un ZIP vacio.");
  }

  return analyzeExtractedPackage(fileContents);
}

function analyzeExtractedPackage(fileContents: Map<string, string>): AnalyzeResult {
  const manifestRaw = fileContents.get("manifest.json");
  if (!manifestRaw) {
    throw new Error("El archivo .mcp no contiene un manifest.json valido.");
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    throw new Error("El manifest.json no es un JSON valido.");
  }

  validateManifestStructure(manifest);
  const typedManifest = manifest as McpManifest;

  validateManifestVersion(typedManifest);
  validateChecksums(typedManifest, fileContents);

  const warnings: string[] = [];
  const errors: string[] = [];

  // Check required modules
  for (const manifestModule of typedManifest.modules) {
    if (!manifestModule.required) {
      continue;
    }

    if (!fileContents.has(manifestModule.path)) {
      errors.push(`Falta el modulo obligatorio ${manifestModule.path}.`);
    }
  }

  // Check optional modules and warn about missing ones
  for (const manifestModule of typedManifest.modules) {
    if (manifestModule.required) {
      continue;
    }

    if (!fileContents.has(manifestModule.path)) {
      warnings.push(`Modulo opcional ${manifestModule.path} no incluido en el paquete.`);
    }
  }

  // Verify project.json exists
  if (!fileContents.has("project.json")) {
    errors.push("Falta el archivo project.json del modulo project.");
  }

  const modules = typedManifest.modules.map((manifestModule) => ({
    id: manifestModule.id,
    present: fileContents.has(manifestModule.path),
    required: manifestModule.required,
  }));

  const compatibility = errors.length > 0
    ? "unsupported"
    : warnings.length > 0
      ? "supported_with_warnings"
      : "supported";

  return {
    preview: {
      compatibility,
      projectName: typedManifest.project.name,
      formatVersion: typedManifest.formatVersion,
      sourceApp: typedManifest.source.app,
      sourceAppVersion: typedManifest.source.appVersion,
      modules,
      warnings,
      errors,
    },
    manifest: typedManifest,
    fileContents,
  };
}
