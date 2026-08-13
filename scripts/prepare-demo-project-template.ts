import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateChecksums } from "@/lib/mcp/checksums";
import { validateManifestVersion } from "@/lib/mcp/manifest";
import { validateManifestStructure } from "@/lib/mcp/schema";
import type { McpManifest } from "@/lib/mcp/types";

const sourcePath = join(process.cwd(), "presupuesto-ejemplo", "mcp", "test-completo-exportar.mcp");
const targetPath = join(process.cwd(), "data-for-seed", "demo-projects", "edificio-multifamiliar-demo.mcp");

const sourceBuffer = readFileSync(sourcePath);
const fileContents = extractStoredZip(sourceBuffer);
const manifestRaw = fileContents.get("manifest.json");

if (!manifestRaw) {
  throw new Error("Demo MCP does not contain a valid manifest.json.");
}

const parsedManifest: unknown = JSON.parse(manifestRaw);
validateManifestStructure(parsedManifest);
const manifest = parsedManifest as McpManifest;
validateManifestVersion(manifest);
validateChecksums(manifest, fileContents);

const missingRequiredModules = manifest.modules
  .filter((module) => module.required && !fileContents.has(module.path))
  .map((module) => module.path);

if (missingRequiredModules.length > 0) {
  throw new Error(`Demo MCP incompatible: missing required modules ${missingRequiredModules.join(", ")}`);
}

if (!fileContents.has("project.json")) {
  throw new Error("Demo MCP incompatible: missing project.json.");
}

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, sourceBuffer);

console.log(`Demo MCP copied to ${targetPath}`);
console.log(`Source project: ${manifest.project.name}`);
console.log(`Modules: ${manifest.modules.map((module) => module.id).join(", ")}`);

function extractStoredZip(buffer: Buffer): Map<string, string> {
  if (buffer.length < 22) {
    throw new Error("Demo MCP is too small to be a valid ZIP package.");
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    throw new Error("Demo MCP does not contain a ZIP central directory.");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const files = new Map<string, string>();
  let currentOffset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (currentOffset + 46 > buffer.length || buffer.readUInt32LE(currentOffset) !== 0x02014b50) {
      throw new Error("Demo MCP contains an invalid ZIP central directory entry.");
    }

    const compressionMethod = buffer.readUInt16LE(currentOffset + 10);
    const compressedSize = buffer.readUInt32LE(currentOffset + 20);
    const fileNameLength = buffer.readUInt16LE(currentOffset + 28);
    const extraFieldLength = buffer.readUInt16LE(currentOffset + 30);
    const commentLength = buffer.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(currentOffset + 42);
    const fileNameStart = currentOffset + 46;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameStart + fileNameLength);

    if (compressionMethod !== 0) {
      throw new Error(`Demo MCP entry "${fileName}" uses unsupported compression.`);
    }

    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Demo MCP entry "${fileName}" has an invalid local header.`);
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const contentStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const contentEnd = contentStart + compressedSize;

    if (contentEnd > buffer.length) {
      throw new Error(`Demo MCP entry "${fileName}" extends beyond the package.`);
    }

    files.set(fileName, buffer.toString("utf8", contentStart, contentEnd));
    currentOffset = fileNameStart + fileNameLength + extraFieldLength + commentLength;
  }

  if (files.size === 0) {
    throw new Error("Demo MCP is an empty ZIP package.");
  }

  return files;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumSize = 22;
  const maximumCommentSize = 65535;
  const searchStart = Math.max(0, buffer.length - minimumSize - maximumCommentSize);
  const searchEnd = buffer.length - minimumSize;

  for (let offset = searchEnd; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}
