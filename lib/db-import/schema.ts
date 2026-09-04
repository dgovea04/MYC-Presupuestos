import type { DbSchemaInspection } from "@/lib/db-import/types";
import { DB_IMPORT_SCHEMA_VERSION } from "@/lib/db-import/types";

export type SqliteColumn = {
  name: string;
  type?: string;
  notnull?: number;
  pk?: number;
};

export type SqliteStatement = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
};

export type SqliteDatabase = {
  prepare(sql: string): SqliteStatement;
  close(): void;
};

export const requiredDbTables = ["proyectos", "partidas", "recursos", "acu_items"] as const;
export const optionalDbTables = ["sub_presupuestos", "biblioteca_cu", "biblioteca_acu_items", "configuracion"] as const;

export const requiredDbColumns: Record<string, readonly string[]> = {
  proyectos: ["id", "nombre"],
  partidas: ["id", "proyecto_id", "item", "descripcion", "unidad", "metrado", "precio_unitario", "nivel", "es_titulo"],
  recursos: ["id", "codigo", "descripcion", "tipo", "unidad", "precio"],
  acu_items: ["id", "partida_id", "recurso_id", "cantidad"],
};

export function detectDbSchema(db: SqliteDatabase): DbSchemaInspection {
  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name?: string }>;
  const tables = tableRows.map((row) => row.name?.trim()).filter((name): name is string => Boolean(name));
  const missingTables = requiredDbTables.filter((table) => !tables.includes(table));
  const missingColumns: string[] = [];

  for (const table of requiredDbTables) {
    if (!tables.includes(table)) {
      continue;
    }

    const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as SqliteColumn[];
    const columnNames = new Set(columns.map((column) => column.name));
    for (const requiredColumn of requiredDbColumns[table] ?? []) {
      if (!columnNames.has(requiredColumn)) {
        missingColumns.push(`${table}.${requiredColumn}`);
      }
    }
  }

  const status = missingTables.length > 0 || missingColumns.length > 0
    ? "incompatible"
    : tables.includes("sub_presupuestos")
      ? "compatible"
      : "compatible_with_warnings";

  return {
    status,
    version: DB_IMPORT_SCHEMA_VERSION,
    tables,
    missingTables,
    missingColumns,
  };
}

export function assertCompatibleDbSchema(inspection: DbSchemaInspection) {
  if (inspection.status === "incompatible") {
    const missing = [...inspection.missingTables, ...inspection.missingColumns];
    throw new Error(`La base .db no usa un schema compatible. Faltan: ${missing.join(", ") || "tablas o columnas requeridas"}.`);
  }
}

export function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error("Identificador SQLite no valido.");
  }

  return `"${identifier}"`;
}
