import { createHash } from "node:crypto";

import { ExtractionStatus, Prisma, ReviewDocumentCategory, type ReviewDocumentCategory as ReviewDocumentCategoryType } from "@prisma/client";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".xlsx"]);
const PDF_MIME = "application/pdf";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ReviewDocumentFile = File;

export type ProjectDocumentInput = {
  companyId: string;
  projectId: string;
  createdById: string;
  name: string;
  originalFileName: string;
  category?: ReviewDocumentCategoryType;
};

export type DocumentVersionInput = {
  companyId: string;
  projectId: string;
  projectDocumentId: string;
  storageKey: string;
  file: ReviewDocumentFile;
};

export type ProjectDocumentRecord = Prisma.ProjectDocumentGetPayload<{
  select: { id: true; companyId: true; projectId: true; originalFileName: true };
}>;
export type DocumentVersionRecord = Prisma.DocumentVersionGetPayload<{
  select: { id: true; projectDocumentId: true; versionNumber: true; sha256: true };
}>;

export type DocumentClient = {
  projectDocument: {
    findFirst(args: { where: { companyId: string; projectId: string; originalFileName?: string; id?: string } }): Promise<ProjectDocumentRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<ProjectDocumentRecord>;
    update(args: { where: { id: string; companyId: string; projectId: string }; data: { currentVersionId: string } }): Promise<ProjectDocumentRecord>;
  };
  documentVersion: {
    findFirst(args: { where: { companyId: string; projectId: string; projectDocumentId: string; sha256: string } }): Promise<DocumentVersionRecord | null>;
    aggregate(args: { where: { companyId: string; projectId: string; projectDocumentId: string }; _max: { versionNumber: true } }): Promise<{ _max: { versionNumber: number | null } }>;
    create(args: { data: Record<string, unknown> }): Promise<DocumentVersionRecord>;
  };
  $transaction<T>(callback: (transaction: DocumentClient) => Promise<T>): Promise<T>;
};

export type ProjectDocumentAndVersionInput = ProjectDocumentInput & Pick<DocumentVersionInput, "storageKey" | "file">;

export async function createProjectDocumentAndVersion(
  input: ProjectDocumentAndVersionInput,
  client: DocumentClient,
): Promise<{ document: ProjectDocumentRecord; version: DocumentVersionRecord }> {
  const validated = await validateDocumentFile(input.file);
  return client.$transaction(async (transaction) => {
    const document = await transaction.projectDocument.findFirst({ where: { companyId: input.companyId, projectId: input.projectId, originalFileName: input.originalFileName } }) ?? await transaction.projectDocument.create({ data: { companyId: input.companyId, projectId: input.projectId, createdById: input.createdById, name: input.name, originalFileName: input.originalFileName, category: input.category ?? ReviewDocumentCategory.OTHER } });
    const existing = await transaction.documentVersion.findFirst({ where: { companyId: input.companyId, projectId: input.projectId, projectDocumentId: document.id, sha256: validated.sha256 } });
    if (existing) return { document, version: existing };
    const aggregate = await transaction.documentVersion.aggregate({ where: { companyId: input.companyId, projectId: input.projectId, projectDocumentId: document.id }, _max: { versionNumber: true } });
    const version = await transaction.documentVersion.create({ data: { companyId: input.companyId, projectId: input.projectId, projectDocumentId: document.id, versionNumber: (aggregate._max.versionNumber ?? 0) + 1, storageKey: input.storageKey, originalFileName: input.file.name, mimeType: validated.mimeType, fileSizeBytes: validated.fileSizeBytes, sha256: validated.sha256, extractionStatus: ExtractionStatus.PENDING } });
    await transaction.projectDocument.update({ where: { id: document.id, companyId: input.companyId, projectId: input.projectId }, data: { currentVersionId: version.id } });
    return { document, version };
  });
}

export async function createProjectDocument(
  input: ProjectDocumentInput,
  client: DocumentClient,
): Promise<ProjectDocumentRecord> {
  const existing = await client.projectDocument.findFirst({
    where: {
      companyId: input.companyId,
      projectId: input.projectId,
      originalFileName: input.originalFileName,
    },
  });
  if (existing) {
    return existing;
  }

  return client.projectDocument.create({
    data: {
      companyId: input.companyId,
      projectId: input.projectId,
      createdById: input.createdById,
      name: input.name,
      originalFileName: input.originalFileName,
      category: input.category ?? ReviewDocumentCategory.OTHER,
    },
  });
}

export async function createDocumentVersion(
  input: DocumentVersionInput,
  client: DocumentClient,
): Promise<DocumentVersionRecord> {
  const validated = await validateDocumentFile(input.file);
  try {
    return await client.$transaction(async (transaction) => {
      const document = await transaction.projectDocument.findFirst({
        where: {
          id: input.projectDocumentId,
          companyId: input.companyId,
          projectId: input.projectId,
        },
      });
      if (!document) {
        throw new Error("El documento no pertenece a la empresa y proyecto indicados.");
      }

      const existing = await transaction.documentVersion.findFirst({
        where: {
          companyId: input.companyId,
          projectId: input.projectId,
          projectDocumentId: input.projectDocumentId,
          sha256: validated.sha256,
        },
      });
      if (existing) {
        return existing;
      }

      const aggregate = await transaction.documentVersion.aggregate({
        where: {
          companyId: input.companyId,
          projectId: input.projectId,
          projectDocumentId: input.projectDocumentId,
        },
        _max: { versionNumber: true },
      });
      const created = await transaction.documentVersion.create({
        data: {
          companyId: input.companyId,
          projectId: input.projectId,
          projectDocumentId: input.projectDocumentId,
          versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
          storageKey: input.storageKey,
          originalFileName: input.file.name,
          mimeType: validated.mimeType,
          fileSizeBytes: validated.fileSizeBytes,
          sha256: validated.sha256,
          extractionStatus: ExtractionStatus.PENDING,
        },
      });
      await transaction.projectDocument.update({
        where: {
          id: input.projectDocumentId,
          companyId: input.companyId,
          projectId: input.projectId,
        },
        data: { currentVersionId: created.id },
      });
      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("no pertenece")) {
      throw error;
    }
    const existing = await client.documentVersion.findFirst({
      where: {
        companyId: input.companyId,
        projectId: input.projectId,
        projectDocumentId: input.projectDocumentId,
        sha256: validated.sha256,
      },
    });
    if (existing) {
      return existing;
    }
    throw error;
  }
}

export type ValidatedDocument = {
  bytes: Uint8Array;
  sha256: string;
  mimeType: typeof PDF_MIME | typeof XLSX_MIME;
  extension: ".pdf" | ".xlsx";
  fileSizeBytes: number;
};

export async function validateDocumentFile(file: ReviewDocumentFile): Promise<ValidatedDocument> {
  const extension = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Extensión de documento no soportada.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("El documento excede el límite de 50 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const supportedExtension: ".pdf" | ".xlsx" = extension === ".pdf" ? ".pdf" : ".xlsx";
  const detectedMime = await detectMime(bytes);
  if (detectedMime === null || detectedMime !== expectedMime(supportedExtension)) {
    throw new Error("El MIME real del documento no coincide con la extensión.");
  }
  if (file.type !== "" && file.type !== detectedMime) {
    throw new Error("El MIME declarado no coincide con el MIME real del documento.");
  }

  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mimeType: detectedMime,
    extension: supportedExtension,
    fileSizeBytes: bytes.byteLength,
  };
}

function getExtension(fileName: string): ".pdf" | ".xlsx" | string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function expectedMime(extension: string): typeof PDF_MIME | typeof XLSX_MIME | null {
  return extension === ".pdf" ? PDF_MIME : extension === ".xlsx" ? XLSX_MIME : null;
}

async function detectMime(bytes: Uint8Array): Promise<typeof PDF_MIME | typeof XLSX_MIME | null> {
  const prefix = new TextDecoder().decode(bytes.slice(0, 5));
  if (prefix === "%PDF-") {
    return isValidPdfStructure(bytes) ? PDF_MIME : null;
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(bytes);
      const entries = new Set(Object.keys(zip.files));
      if (entries.has("[Content_Types].xml") && entries.has("xl/workbook.xml")) {
        return XLSX_MIME;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function isValidPdfStructure(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  const startxref = text.match(/\bstartxref\s+(\d+)\s+%%EOF\s*$/);
  const xref = /\bxref\s+\d+\s+\d+\s+\d{10}\s+\d{5}\s+[fn]\s/.test(text);
  const trailer = /\btrailer\s*<<[\s\S]*>>/.test(text);
  const hasObjects = /\b\d+\s+\d+\s+obj\b[\s\S]*\bendobj\b/.test(text);
  return startxref !== null && Number(startxref[1]) <= bytes.byteLength && xref && trailer && hasObjects;
}
