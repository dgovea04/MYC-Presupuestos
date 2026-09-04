import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DB_IMPORT_MAX_BYTES, isSupportedDbFileName } from "@/lib/db-import/types";

export class DbUploadError extends Error {
  readonly status: 400 | 413;

  constructor(message: string, status: 400 | 413) {
    super(message);
    this.name = "DbUploadError";
    this.status = status;
  }
}

export async function withTemporaryDbUpload<T>(file: File, callback: (filePath: string) => Promise<T> | T): Promise<T> {
  if (!isSupportedDbFileName(file.name)) {
    throw new DbUploadError("El archivo debe tener extension .db, .sqlite o .sqlite3.", 400);
  }

  if (file.size > DB_IMPORT_MAX_BYTES) {
    throw new DbUploadError(`La base .db supera el limite de ${Math.round(DB_IMPORT_MAX_BYTES / 1024 / 1024)} MB.`, 413);
  }

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "myc-db-import-"));
  const temporaryPath = path.join(temporaryDirectory, `${randomUUID()}.db`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(temporaryPath, buffer, { flag: "wx" });
    return await callback(temporaryPath);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
