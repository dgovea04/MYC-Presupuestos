import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";
import type { S10SnapshotContract } from "@/lib/s10/snapshot-contract";

export const DB_IMPORT_FORMATS = [".db", ".sqlite", ".sqlite3"] as const;
export const DB_IMPORT_MAX_BYTES = 80 * 1024 * 1024;
export const DB_IMPORT_SCHEMA_VERSION = "mc.db.sqlite.v1" as const;

export type DbImportFormat = (typeof DB_IMPORT_FORMATS)[number];
export type DbImportMode = "upload" | "local_path";
export type DbSchemaStatus = "compatible" | "compatible_with_warnings" | "incompatible";

export type DbSchemaInspection = {
  status: DbSchemaStatus;
  version: typeof DB_IMPORT_SCHEMA_VERSION;
  tables: string[];
  missingTables: string[];
  missingColumns: string[];
};

export type DbImportedResource = {
  id: string;
  code: string;
  description: string;
  type: string;
  unit: string;
  unitPrice: string;
  unifiedIndexCode: string | null;
  category: string | null;
};

export type DbImportedApuRow = {
  id: string;
  resourceId: string;
  code: string;
  description: string;
  type: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  crew: string | null;
};

export type DbImportedBudgetItem = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  level: number;
  isTitle: boolean;
  order: number;
  productivity: string | null;
  group: string | null;
  apuRows: DbImportedApuRow[];
};

export type DbImportedSubBudget = {
  id: string;
  name: string;
  order: number;
  items: DbImportedBudgetItem[];
};

export type DbImportedProject = {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  currency: string | null;
  generalExpensesRate: string | null;
  utilityRate: string | null;
  taxRate: string | null;
  resources: DbImportedResource[];
  subBudgets: DbImportedSubBudget[];
  warnings: string[];
};

export type DbSubBudgetSummary = {
  id: string;
  name: string;
  itemCount: number;
};

export type DbProjectSummary = {
  id: string;
  name: string;
  subBudgetCount: number;
  itemCount: number;
  subBudgets: DbSubBudgetSummary[];
};

export type DbReadResult = {
  inspection: DbSchemaInspection;
  project: DbImportedProject;
};

export type DbSnapshotResult = {
  snapshot: S10SnapshotContract;
  inspection: DbSchemaInspection;
  project: DbImportedProject;
};

export function isSupportedDbFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return DB_IMPORT_FORMATS.some((extension) => normalized.endsWith(extension));
}

export function getDbFileExtension(fileName: string): DbImportFormat | null {
  const normalized = fileName.trim().toLowerCase();
  return DB_IMPORT_FORMATS.find((extension) => normalized.endsWith(extension)) ?? null;
}

export function isDbSnapshot(value: unknown): value is S10ExportSnapshot {
  return typeof value === "object" && value !== null &&
    "presupuestos" in value && Array.isArray(value.presupuestos) &&
    "subpresupuestos" in value && Array.isArray(value.subpresupuestos) &&
    "partidas" in value && Array.isArray(value.partidas) &&
    "apuDetalles" in value && Array.isArray(value.apuDetalles);
}
