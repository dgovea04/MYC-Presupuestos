import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getAuthSession } from "@/lib/auth/session";
import { isS10LocalSqlServerEnabled, restoreLocalS10Backup } from "@/lib/s10/sqlserver-local";
import {
  isRecord,
  readBooleanRecordValue,
  readOptionalRecordString,
  readRequiredRecordString,
  S10SqlServerRequestError,
} from "@/app/api/imports/s10/sqlserver/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestoreRequestInput = {
  server: string;
  backupPath: string;
  databaseName: string;
  replaceExisting: boolean;
  user?: string;
  password?: string;
  trustServerCertificate: boolean;
  temporaryBackupPath?: string;
};

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isS10LocalSqlServerEnabled()) {
    return NextResponse.json({ error: "La restauracion local de S10 solo esta habilitada en entorno local." }, { status: 403 });
  }

  try {
    const input = await readRestoreRequestInput(request);
    try {
      const result = restoreLocalS10Backup({
        server: input.server,
        backupPath: input.backupPath,
        databaseName: input.databaseName,
        replaceExisting: input.replaceExisting,
        user: input.user,
        password: input.password,
        trustServerCertificate: input.trustServerCertificate,
      });

      return NextResponse.json(result);
    } finally {
      if (input.temporaryBackupPath) {
        fs.rmSync(input.temporaryBackupPath, { force: true });
      }
    }
  } catch (error) {
    if (error instanceof S10SqlServerRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo restaurar el backup S10 local." },
      { status: 400 },
    );
  }
}

async function readRestoreRequestInput(request: Request): Promise<RestoreRequestInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return readMultipartRestoreRequestInput(request);
  }

  const body: unknown = await request.json();
  if (!isRecord(body)) {
    throw new S10SqlServerRequestError("Envia un body JSON valido.", 400);
  }

  return {
    server: readRequiredRecordString(body, "server"),
    backupPath: readRequiredRecordString(body, "backupPath"),
    databaseName: readRequiredRecordString(body, "databaseName"),
    replaceExisting: readBooleanRecordValue(body, "replaceExisting", false),
    user: readOptionalRecordString(body, "user"),
    password: readOptionalRecordString(body, "password"),
    trustServerCertificate: readBooleanRecordValue(body, "trustServerCertificate", true),
  };
}

async function readMultipartRestoreRequestInput(request: Request): Promise<RestoreRequestInput> {
  const formData = await request.formData();
  const file = formData.get("file");
  const backupPathField = readOptionalFormDataString(formData, "backupPath");
  let temporaryBackupPath: string | undefined;
  let backupPath = backupPathField;

  if (file instanceof File) {
    if (!file.name.toLowerCase().endsWith(".s2k")) {
      throw new S10SqlServerRequestError("El archivo debe tener extension .s2k.", 400);
    }

    temporaryBackupPath = await saveUploadedBackupFile(file);
    backupPath = temporaryBackupPath;
  }

  if (!backupPath) {
    throw new S10SqlServerRequestError("Falta backupPath.", 400);
  }

  return {
    server: readRequiredFormDataString(formData, "server"),
    backupPath,
    databaseName: readRequiredFormDataString(formData, "databaseName"),
    replaceExisting: readBooleanFormDataValue(formData, "replaceExisting", false),
    user: readOptionalFormDataString(formData, "user"),
    password: readOptionalFormDataString(formData, "password"),
    trustServerCertificate: readBooleanFormDataValue(formData, "trustServerCertificate", true),
    temporaryBackupPath,
  };
}

async function saveUploadedBackupFile(file: File) {
  const uploadDirectory = path.join(/*turbopackIgnore: true*/ process.cwd(), ".myc-local-s10", "uploads");
  fs.mkdirSync(uploadDirectory, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}-${sanitizeUploadedFileName(file.name)}`;
  const filePath = path.join(uploadDirectory, fileName);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
  return filePath;
}

function readRequiredFormDataString(formData: FormData, key: string) {
  const value = readOptionalFormDataString(formData, key);
  if (!value) {
    throw new S10SqlServerRequestError(`Falta ${key}.`, 400);
  }

  return value;
}

function readOptionalFormDataString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readBooleanFormDataValue(formData: FormData, key: string, fallback: boolean) {
  const value = readOptionalFormDataString(formData, key);
  if (!value) {
    return fallback;
  }

  return value === "true";
}

function sanitizeUploadedFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
