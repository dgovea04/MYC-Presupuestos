import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSha256Checksums, validateChecksums } from "@/lib/mcp/checksums";
import { validateManifestVersion } from "@/lib/mcp/manifest";
import { validateManifestStructure } from "@/lib/mcp/schema";
import type { McpManifest, McpModuleId } from "@/lib/mcp/types";

const sourcePath = join(process.cwd(), "presupuesto-ejemplo", "mcp", "test-completo-exportar.mcp");
const targetPath = join(process.cwd(), "data-for-seed", "demo-projects", "edificio-multifamiliar-demo.mcp");

let sourceBuffer = readFileSync(sourcePath);
const fileContents = extractStoredZip(sourceBuffer);
const manifestRaw = fileContents.get("manifest.json");

if (!manifestRaw) {
  throw new Error("Demo MCP does not contain a valid manifest.json.");
}

const parsedManifest: unknown = JSON.parse(manifestRaw);
validateManifestStructure(parsedManifest);
let manifest = parsedManifest as McpManifest;
validateManifestVersion(manifest);
validateChecksums(manifest, fileContents);

if (!fileContents.has("budgets/project-resources.json")) {
  const repaired = addProjectResourcesModule(fileContents, manifest);
  sourceBuffer = repaired.buffer;
  manifest = repaired.manifest;
  fileContents.clear();
  for (const [path, content] of repaired.fileContents) {
    fileContents.set(path, content);
  }
}

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

function addProjectResourcesModule(
  fileContents: Map<string, string>,
  manifest: McpManifest,
): { buffer: Buffer; manifest: McpManifest; fileContents: Map<string, string> } {
  const apusRaw = fileContents.get("budgets/apus.json");
  if (!apusRaw) {
    throw new Error("Demo MCP incompatible: missing budgets/apus.json.");
  }

  const resources = collectProjectResourcesFromApus(JSON.parse(apusRaw));
  const repairedContents = new Map(fileContents);
  repairedContents.set("budgets/project-resources.json", JSON.stringify({ resources }, null, 2));

  const rawFiles = [...repairedContents.entries()]
    .filter(([path]) => path !== "manifest.json" && path !== "checksums/sha256.json")
    .map(([path, content]) => ({ path, content }));
  const checksums = createSha256Checksums(rawFiles);
  const modules = manifest.modules.some((module) => module.path === "budgets/project-resources.json")
    ? manifest.modules
    : [
        ...manifest.modules,
        {
          id: "project_resources" as McpModuleId,
          path: "budgets/project-resources.json",
          required: false,
        },
      ];
  const repairedManifest = {
    ...manifest,
    modules,
    checksums,
  };

  repairedContents.set("checksums/sha256.json", JSON.stringify(checksums, null, 2));
  repairedContents.set("manifest.json", JSON.stringify(repairedManifest, null, 2));

  const orderedEntries = [
    "manifest.json",
    ...rawFiles.map((file) => file.path),
    "checksums/sha256.json",
  ].map((path) => ({
    fileName: path,
    content: repairedContents.get(path) ?? "",
  }));

  return {
    buffer: buildStoredZip(orderedEntries),
    manifest: repairedManifest,
    fileContents: repairedContents,
  };
}

function collectProjectResourcesFromApus(apusData: unknown) {
  if (!isRecord(apusData) || !Array.isArray(apusData.apus)) {
    throw new Error("Demo MCP incompatible: budgets/apus.json invalido.");
  }

  const resourcesByKey = new Map<
    string,
    {
      id: string;
      code: string;
      description: string;
      category: string;
      unit: string;
      currency: string;
      unitPrice: string | number;
      iu: string | null;
      iuCurrent: string | null;
    }
  >();

  for (const apu of apusData.apus) {
    if (!isRecord(apu) || !Array.isArray(apu.resources)) continue;

    for (const resource of apu.resources) {
      if (!isRecord(resource)) continue;

      const sourceId = readString(resource.resourceId);
      const description = readString(resource.resourceDescription);
      const resourceType = readString(resource.resourceType);
      const unitPrice = readString(resource.unitPrice) ?? "0";
      if (!sourceId || !description || !resourceType) continue;

      const key = `${sourceId}|${description}|${resourceType}|${unitPrice}`;
      if (resourcesByKey.has(key)) continue;

      resourcesByKey.set(key, {
        id: sourceId,
        code: `IMP-${String(resourcesByKey.size + 1).padStart(4, "0")}`,
        description,
        category: normalizeResourceCategory(resourceType),
        unit: "und",
        currency: manifest.project.currency || "PEN",
        unitPrice,
        iu: null,
        iuCurrent: null,
      });
    }
  }

  return [...resourcesByKey.values()];
}

function normalizeResourceCategory(resourceType: string) {
  const normalized = resourceType.trim().toUpperCase();
  if (normalized === "MO") return "LABOR";
  if (
    normalized === "MATERIAL" ||
    normalized === "LABOR" ||
    normalized === "EQUIPMENT" ||
    normalized === "TOOLS" ||
    normalized === "SUBCONTRACT"
  ) {
    return normalized;
  }

  return "MATERIAL";
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function buildStoredZip(entries: Array<{ fileName: string; content: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.byteLength, 18);
    localHeader.writeUInt32LE(content.byteLength, 22);
    localHeader.writeUInt16LE(fileName.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.byteLength, 20);
    centralHeader.writeUInt32LE(content.byteLength, 24);
    centralHeader.writeUInt16LE(fileName.byteLength, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, fileName);
    offset += localHeader.byteLength + fileName.byteLength + content.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  const crcTable = getCrcTable();
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

var crcTableCache: number[] | null = null;

function getCrcTable() {
  crcTableCache ??= Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    return crc >>> 0;
  });

  return crcTableCache;
}
