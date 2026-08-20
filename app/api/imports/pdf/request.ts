import type { PdfImportDocumentRole } from "@/lib/pdf-import/types";

export const maxPdfImportUploadBytes = 100 * 1024 * 1024;
export const maxPdfImportFileCount = 10;
export const maxPdfImportPageCount = 300;

export type PdfImportUploadedFile = {
  file: File;
  role: PdfImportDocumentRole;
};

export type PdfImportMultipartInput = {
  companyId: string;
  projectName?: string;
  currency: string;
  priceTolerance: string;
  files: PdfImportUploadedFile[];
};

export class PdfImportRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function readPdfImportMultipartInput(request: Request): Promise<PdfImportMultipartInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new PdfImportRequestError("Envia los PDFs como multipart/form-data.", 400);
  }

  const formData = await request.formData();
  const companyId = readRequiredFormString(formData, "companyId", "Selecciona la empresa donde se importara el proyecto PDF.");
  const projectName = readOptionalFormString(formData, "projectName");
  const currency = readOptionalFormString(formData, "currency") ?? "PEN";
  const priceTolerance = readOptionalFormString(formData, "priceTolerance") ?? "0.01";
  const fileRoles = readFileRoles(formData);
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    throw new PdfImportRequestError("Adjunta al menos un PDF del proyecto.", 400);
  }
  if (files.length > maxPdfImportFileCount) {
    throw new PdfImportRequestError(`Adjunta como maximo ${maxPdfImportFileCount} PDFs por importacion.`, 413);
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxPdfImportUploadBytes) {
    throw new PdfImportRequestError("El paquete PDF supera el limite de 100 MB.", 413);
  }

  return {
    companyId,
    projectName,
    currency,
    priceTolerance,
    files: files.map((file) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        throw new PdfImportRequestError("Todos los archivos deben tener extension .pdf.", 400);
      }
      if (file.type !== "application/pdf") {
        throw new PdfImportRequestError("Todos los archivos deben tener MIME application/pdf.", 400);
      }

      return {
        file,
        role: fileRoles.get(file.name) ?? "AUTO",
      };
    }),
  };
}

export function assertPdfImportPageLimit(files: Array<{ pageCount: number }>) {
  const pageCount = files.reduce((sum, file) => sum + file.pageCount, 0);
  if (pageCount > maxPdfImportPageCount) {
    throw new PdfImportRequestError(`El paquete PDF supera el limite de ${maxPdfImportPageCount} paginas.`, 413);
  }
}

function readFileRoles(formData: FormData) {
  const raw = readOptionalFormString(formData, "fileRoles");
  const roles = new Map<string, PdfImportDocumentRole>();
  if (!raw) {
    return roles;
  }

  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    return roles;
  }

  for (const [fileName, role] of Object.entries(parsed)) {
    if (typeof role === "string" && isPdfImportDocumentRole(role)) {
      roles.set(fileName, role);
    }
  }

  return roles;
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredFormString(formData: FormData, key: string, message: string) {
  const value = readOptionalFormString(formData, key);
  if (!value) {
    throw new PdfImportRequestError(message, 400);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPdfImportDocumentRole(value: string): value is PdfImportDocumentRole {
  return ["BUDGET", "APU", "SUBPARTIDAS", "OTHER", "AUTO"].includes(value);
}
