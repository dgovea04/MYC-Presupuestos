import { createHash } from "node:crypto";
import type { McpManifest } from "./types";

export function createSha256Checksums(files: Array<{ path: string; content: string | Buffer | Uint8Array }>): Record<string, string> {
  const checksums: Record<string, string> = {};

  for (const file of files) {
    const content = normalizeContent(file.content);
    checksums[file.path] = createHash("sha256").update(content).digest("hex");
  }

  return checksums;
}

export function createSha256Hash(content: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(normalizeContent(content)).digest("hex");
}

export function validateChecksums(manifest: McpManifest, fileContents: Map<string, string | Buffer | Uint8Array>): void {
  for (const [path, expectedHash] of Object.entries(manifest.checksums)) {
    const content = fileContents.get(path);
    if (!content) {
      if (manifest.modules.some((m) => m.path === path && m.required)) {
        throw new Error(`Falta el modulo obligatorio ${path}.`);
      }
      continue;
    }

    const actualHash = createHash("sha256").update(normalizeContent(content)).digest("hex");
    if (actualHash !== expectedHash) {
      throw new Error(`El checksum de ${path} no coincide con el manifest.`);
    }
  }
}

function normalizeContent(content: string | Buffer | Uint8Array): Buffer {
  if (typeof content === "string") return Buffer.from(content, "utf8");
  if (Buffer.isBuffer(content)) return content;
  return Buffer.from(content);
}
