/**
 * Schema validation helpers for .mcp package modules.
 * V1 performs lightweight structural checks without full JSON Schema.
 */

import type { McpManifest } from "./types";

const MANIFEST_REQUIRED_FIELDS = [
  "format",
  "formatVersion",
  "schemaVersion",
  "exportedAt",
  "source",
  "package",
  "project",
  "modules",
  "capabilities",
  "namespaces",
  "checksums",
] as const;

export function validateManifestStructure(manifest: unknown): manifest is McpManifest {
  if (!isRecord(manifest)) {
    throw new Error("El manifest.json no es un objeto valido.");
  }

  for (const field of MANIFEST_REQUIRED_FIELDS) {
    if (!(field in manifest)) {
      throw new Error(`El manifest.json no contiene el campo obligatorio "${field}".`);
    }
  }

  if (manifest.format !== "MC_PROJECT_PACKAGE") {
    throw new Error('El manifest.json no tiene el formato esperado "MC_PROJECT_PACKAGE".');
  }

  if (!isRecord(manifest.package) || manifest.package.fileExtension !== ".mcp") {
    throw new Error("El manifest.json indica una extension de archivo incorrecta.");
  }

  if (!Array.isArray(manifest.modules)) {
    throw new Error("El manifest.json no contiene el array de modulos.");
  }

  for (const manifestModule of manifest.modules) {
    if (!isRecord(manifestModule) || typeof manifestModule.path !== "string" || typeof manifestModule.id !== "string") {
      throw new Error("El manifest.json tiene un modulo con formato incorrecto.");
    }
  }

  if (!isRecord(manifest.checksums)) {
    throw new Error("El manifest.json no contiene checksums.");
  }

  return true;
}

export function validateRequiredModulesPresent(
  manifest: McpManifest,
  extractedPaths: Set<string>,
): string[] {
  const errors: string[] = [];

  for (const manifestModule of manifest.modules) {
    if (!manifestModule.required) {
      continue;
    }

    if (!extractedPaths.has(manifestModule.path)) {
      errors.push(`Falta el modulo obligatorio ${manifestModule.path}.`);
    }
  }

  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
