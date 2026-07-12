import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ATTACHMENTS_DIRECTORY = path.join(process.cwd(), "public", "uploads", "project-attachments");
const ATTACHMENT_PUBLIC_PREFIX = "/uploads/project-attachments";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

type StoredAttachmentFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  type: string;
  size: number;
};

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "xlsx",
  "doc",
  "xls",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "dwg",
  "rvt",
  "rfa",
  "txt",
  "csv",
]);

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function validateAttachment(file: StoredAttachmentFile) {
  const extension = getFileExtension(file.name);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Tipo de archivo no permitido: .${extension}`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }

  if (file.size === 0) {
    throw new Error("El archivo está vacío");
  }
}

async function ensureProjectDirectory(projectId: string) {
  await mkdir(path.join(ATTACHMENTS_DIRECTORY, projectId), { recursive: true });
}

export async function storeProjectAttachment(
  projectId: string,
  file: StoredAttachmentFile,
) {
  validateAttachment(file);
  await ensureProjectDirectory(projectId);

  const extension = getFileExtension(file.name);
  const baseName = file.name.slice(0, file.name.lastIndexOf("."));
  const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const fileName = `${sanitizedBase}-${Date.now()}.${extension}`;
  const targetPath = path.join(ATTACHMENTS_DIRECTORY, projectId, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, fileBuffer);

  return {
    filePath: `${ATTACHMENT_PUBLIC_PREFIX}/${projectId}/${fileName}`,
    fileName: file.name,
    fileType: file.type || extension,
    fileSize: file.size,
  };
}

export async function deleteStoredAttachment(filePath: string) {
  if (!filePath.startsWith(`${ATTACHMENT_PUBLIC_PREFIX}/`)) {
    return;
  }

  const relativePath = filePath.slice(`${ATTACHMENT_PUBLIC_PREFIX}/`.length);
  const targetPath = path.join(ATTACHMENTS_DIRECTORY, relativePath);

  if (!targetPath.startsWith(ATTACHMENTS_DIRECTORY)) {
    throw new Error("Ruta de archivo inválida");
  }

  await rm(targetPath, { force: true });
}

export async function deleteProjectAttachmentsDirectory(projectId: string) {
  const projectDir = path.join(ATTACHMENTS_DIRECTORY, projectId);
  await rm(projectDir, { recursive: true, force: true });
}
