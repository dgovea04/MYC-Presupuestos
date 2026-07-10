import { buildStoredZip } from "@/lib/exports/centralized";
import type { McpArchiveEntry } from "./types";

export { buildStoredZip };

/**
 * Extracts stored (uncompressed) entries from a ZIP archive buffer.
 * Returns a Map of fileName -> content string.
 */
export function extractStoredZip(buffer: Buffer | Uint8Array): Map<string, string> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const files = new Map<string, string>();

  if (buf.length < 22) {
    throw new Error("El archivo .mcp no tiene la estructura minima de un ZIP valido.");
  }

  // Find End of Central Directory Record (EOCD)
  const eocdOffset = findEocdOffset(buf);

  if (eocdOffset < 0) {
    throw new Error("El archivo .mcp no contiene el directorio central ZIP esperado.");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buf.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buf.readUInt32LE(eocdOffset + 16);

  if (totalEntries === 0) {
    throw new Error("El archivo .mcp es un ZIP vacio.");
  }

  // Read central directory entries
  let currentOffset = centralDirectoryOffset;
  const entryInfos: Array<{
    fileName: string;
    compressionMethod: number;
    compressedSize: number;
    localHeaderOffset: number;
  }> = [];

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (currentOffset + 46 > buf.length) {
      throw new Error("El directorio central ZIP esta truncado.");
    }

    const signature = buf.readUInt32LE(currentOffset);
    if (signature !== 0x02014b50) {
      throw new Error("Firma de entrada del directorio central ZIP invalida.");
    }

    const compressionMethod = buf.readUInt16LE(currentOffset + 10);
    const compressedSize = buf.readUInt32LE(currentOffset + 20);
    const fileNameLength = buf.readUInt16LE(currentOffset + 28);
    const extraFieldLength = buf.readUInt16LE(currentOffset + 30);
    const commentLength = buf.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = buf.readUInt32LE(currentOffset + 42);

    const fileNameStart = currentOffset + 46;
    if (fileNameStart + fileNameLength > buf.length) {
      throw new Error("El nombre de archivo del directorio central ZIP esta truncado.");
    }

    const fileName = buf.toString("utf8", fileNameStart, fileNameStart + fileNameLength);

    entryInfos.push({
      fileName,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    currentOffset = fileNameStart + fileNameLength + extraFieldLength + commentLength;
  }

  // Read local file headers and extract stored content
  for (const entry of entryInfos) {
    const lhOffset = entry.localHeaderOffset;

    if (lhOffset + 30 > buf.length) {
      throw new Error(`El encabezado local de "${entry.fileName}" esta fuera del archivo.`);
    }

    const localSignature = buf.readUInt32LE(lhOffset);
    if (localSignature !== 0x04034b50) {
      throw new Error(`Firma de encabezado local invalida para "${entry.fileName}".`);
    }

    const localFileNameLength = buf.readUInt16LE(lhOffset + 26);
    const localExtraFieldLength = buf.readUInt16LE(lhOffset + 28);

    const contentStart = lhOffset + 30 + localFileNameLength + localExtraFieldLength;
    const contentEnd = contentStart + entry.compressedSize;

    if (contentEnd > buf.length) {
      throw new Error(`El contenido de "${entry.fileName}" esta fuera del archivo.`);
    }

    if (entry.compressionMethod !== 0) {
      throw new Error(
        `El archivo "${entry.fileName}" usa compresion (metodo ${entry.compressionMethod}), que no esta soportada. Solo se aceptan entradas sin compresion.`,
      );
    }

    const content = buf.toString("utf8", contentStart, contentEnd);
    files.set(entry.fileName, content);
  }

  return files;
}

function findEocdOffset(buf: Buffer): number {
  const minEocdSize = 22;
  const maxCommentSize = 65535;
  const searchStart = Math.max(0, buf.length - minEocdSize - maxCommentSize);
  const searchEnd = buf.length - minEocdSize;

  for (let offset = searchEnd; offset >= searchStart; offset -= 1) {
    if (buf.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}
