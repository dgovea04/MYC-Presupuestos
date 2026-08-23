import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const RECEIPTS_DIRECTORY = path.join(process.cwd(), "public", "uploads", "yape-receipts");
const RECEIPTS_PUBLIC_PREFIX = "/uploads/yape-receipts";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type StoredReceiptFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  type: string;
  size: number;
};

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function validateReceipt(file: StoredReceiptFile) {
  const extension = getFileExtension(file.name);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Tipo de archivo no permitido: .${extension}`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`El comprobante excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }

  if (file.size === 0) {
    throw new Error("El comprobante está vacío");
  }
}

export async function storeYapeReceipt(subscriptionId: string, file: StoredReceiptFile) {
  validateReceipt(file);
  await mkdir(path.join(RECEIPTS_DIRECTORY, subscriptionId), { recursive: true });

  const extension = getFileExtension(file.name);
  const baseName = file.name.slice(0, file.name.lastIndexOf("."));
  const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const fileName = `${sanitizedBase}-${Date.now()}.${extension}`;
  const targetPath = path.join(RECEIPTS_DIRECTORY, subscriptionId, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, fileBuffer);

  return {
    filePath: `${RECEIPTS_PUBLIC_PREFIX}/${subscriptionId}/${fileName}`,
    fileName: file.name,
    fileType: file.type || extension,
    fileSize: file.size,
  };
}

export async function deleteStoredYapeReceipt(filePath: string) {
  if (!filePath.startsWith(`${RECEIPTS_PUBLIC_PREFIX}/`)) {
    return;
  }

  const relativePath = filePath.slice(`${RECEIPTS_PUBLIC_PREFIX}/`.length);
  const targetPath = path.join(RECEIPTS_DIRECTORY, relativePath);

  if (!targetPath.startsWith(RECEIPTS_DIRECTORY)) {
    throw new Error("Ruta de comprobante inválida");
  }

  await rm(targetPath, { force: true });
}
