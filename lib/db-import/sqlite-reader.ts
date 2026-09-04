import Decimal from "decimal.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type {
  DbImportedApuRow,
  DbImportedBudgetItem,
  DbImportedResource,
  DbImportedSubBudget,
  DbProjectSummary,
  DbReadResult,
} from "@/lib/db-import/types";
import { DB_IMPORT_MAX_BYTES, isSupportedDbFileName } from "@/lib/db-import/types";
import { assertCompatibleDbSchema, detectDbSchema, quoteIdentifier, type SqliteColumn, type SqliteDatabase } from "@/lib/db-import/schema";

const qrequire = createRequire(import.meta.url);

type SqliteConstructor = new (filePath: string, options?: { readonly?: boolean; fileMustExist?: boolean }) => SqliteDatabase;

export function inspectDbFile(filePath: string) {
  const stats = getRegularFileStats(filePath);
  assertSupportedPath(filePath);
  if (stats.size > DB_IMPORT_MAX_BYTES) {
    throw new Error(`La base .db supera el limite de ${Math.round(DB_IMPORT_MAX_BYTES / 1024 / 1024)} MB.`);
  }

  const header = Buffer.alloc(16);
  const file = fs.openSync(filePath, "r");
  try {
    fs.readSync(file, header, 0, header.length, 0);
  } finally {
    fs.closeSync(file);
  }

  if (!header.subarray(0, 15).equals(Buffer.from("SQLite format 3"))) {
    throw new Error("El archivo no tiene una firma SQLite valida.");
  }

  return { size: stats.size };
}

export function listDbProjects(filePath: string): DbProjectSummary[] {
  return withDatabase(filePath, (db) => {
    const inspection = detectDbSchema(db);
    assertCompatibleDbSchema(inspection);
    const hasSubBudgets = hasUsableTable(db, "sub_presupuestos", ["id", "proyecto_id", "nombre", "orden"]);
    const projects = (db.prepare(`
      SELECT p.id AS id,
             p.nombre AS name,
             ${hasSubBudgets ? "(SELECT COUNT(*) FROM sub_presupuestos sp WHERE sp.proyecto_id = p.id)" : "0"} AS subBudgetCount,
             (SELECT COUNT(*) FROM partidas pa WHERE pa.proyecto_id = p.id AND COALESCE(pa.es_titulo, 0) = 0) AS itemCount
      FROM proyectos p
      ORDER BY p.nombre, p.id
    `).all() as Array<{ id: number | string; name: string; subBudgetCount: number; itemCount: number }>).map((row) => ({
      id: String(row.id),
      name: cleanText(row.name) || `Proyecto ${row.id}`,
      subBudgetCount: toInteger(row.subBudgetCount),
      itemCount: toInteger(row.itemCount),
      subBudgets: [],
    }));

    if (!hasSubBudgets || projects.length === 0) return projects;

    const hasSubBudgetColumn = hasUsableColumn(db, "partidas", "sub_presupuesto_id");
    const subBudgets = db.prepare(`
      SELECT sp.id, sp.proyecto_id AS projectId, sp.nombre AS name,
             (SELECT COUNT(*) FROM partidas pa WHERE ${hasSubBudgetColumn ? "pa.sub_presupuesto_id = sp.id AND" : ""} COALESCE(pa.es_titulo, 0) = 0${hasSubBudgetColumn ? "" : " AND pa.proyecto_id = sp.proyecto_id"}) AS itemCount
      FROM sub_presupuestos sp
      ORDER BY sp.orden, sp.id
    `).all() as Array<{ id: number | string; projectId: number | string; name: string; itemCount: number }>;
    const subBudgetsByProject = new Map<string, Array<{ id: string; name: string; itemCount: number }>>();
    for (const row of subBudgets) {
      const projectSubBudgets = subBudgetsByProject.get(String(row.projectId)) ?? [];
      projectSubBudgets.push({ id: String(row.id), name: cleanText(row.name) || `Subpresupuesto ${row.id}`, itemCount: toInteger(row.itemCount) });
      subBudgetsByProject.set(String(row.projectId), projectSubBudgets);
    }
    return projects.map((project) => ({ ...project, subBudgets: subBudgetsByProject.get(project.id) ?? [] }));
  });
}

export function readDbProject(filePath: string, projectId: string, subBudgetId?: string): DbReadResult {
  return withDatabase(filePath, (db) => {
    const inspection = detectDbSchema(db);
    assertCompatibleDbSchema(inspection);
    const project = readProject(db, projectId);
    const resourcesById = readResources(db);
    const warnings = new Set<string>();
    const hasSubBudgets = hasUsableTable(db, "sub_presupuestos", ["id", "proyecto_id", "nombre", "orden"]);
    const hasSubBudgetColumn = hasUsableColumn(db, "partidas", "sub_presupuesto_id");
    const subBudgets = readSubBudgets(db, project.id, subBudgetId, hasSubBudgets, hasSubBudgetColumn, resourcesById, warnings);

    if (subBudgets.every((subBudget) => subBudget.items.length === 0)) {
      throw new Error(`El proyecto ${project.name} no contiene partidas importables.`);
    }

    return {
      inspection,
      project: {
        ...project,
        resources: [...resourcesById.values()],
        subBudgets,
        warnings: [...warnings],
      },
    };
  });
}

export function readDbSchema(filePath: string) {
  return withDatabase(filePath, (db) => {
    const inspection = detectDbSchema(db);
    assertCompatibleDbSchema(inspection);
    return inspection;
  });
}

function readProject(db: SqliteDatabase, projectId: string) {
  const row = db.prepare(`
    SELECT p.id, p.nombre,
           ${selectColumn(db, "proyectos", "cliente", "p")},
           ${selectColumn(db, "proyectos", "ubicacion", "p")},
           ${selectColumn(db, "proyectos", "moneda", "p")},
           ${selectColumn(db, "proyectos", "gf_pct", "p")},
           ${selectColumn(db, "proyectos", "utilidad_pct", "p")},
           ${selectColumn(db, "proyectos", "igv_pct", "p")}
    FROM proyectos p
    WHERE CAST(p.id AS TEXT) = ?
  `).get(projectId) as {
    id: number | string;
    nombre: string;
    cliente?: string | null;
    ubicacion?: string | null;
    moneda?: string | null;
    gf_pct?: number | string | null;
    utilidad_pct?: number | string | null;
    igv_pct?: number | string | null;
  } | undefined;

  if (!row) {
    throw new Error(`Proyecto no encontrado: ${projectId}.`);
  }

  return {
    id: String(row.id),
    name: cleanText(row.nombre) || `Proyecto ${row.id}`,
    client: cleanOptionalText(row.cliente),
    location: cleanOptionalText(row.ubicacion),
    currency: cleanOptionalText(row.moneda),
    generalExpensesRate: decimalString(row.gf_pct),
    utilityRate: decimalString(row.utilidad_pct),
    taxRate: decimalString(row.igv_pct),
  };
}

function readResources(db: SqliteDatabase) {
  const rows = db.prepare(`
    SELECT r.id, r.codigo, r.descripcion, r.tipo, r.unidad, r.precio,
           ${selectColumn(db, "recursos", "indice_inei", "r")},
           ${selectColumn(db, "recursos", "categoria", "r")}
    FROM recursos r
    ORDER BY r.id
  `).all() as Array<{
    id: number | string;
    codigo?: string | null;
    descripcion?: string | null;
    tipo?: string | null;
    unidad?: string | null;
    precio?: number | string | null;
    indice_inei?: string | null;
    categoria?: string | null;
  }>;
  const resources = new Map<string, DbImportedResource>();

  for (const row of rows) {
    const id = String(row.id);
    resources.set(id, {
      id,
      code: cleanText(row.codigo) || `DB-RESOURCE-${id}`,
      description: cleanText(row.descripcion) || `Recurso ${id}`,
      type: cleanText(row.tipo),
      unit: normalizeUnit(row.unidad),
      unitPrice: decimalString(row.precio) ?? "0",
      unifiedIndexCode: cleanOptionalText(row.indice_inei),
      category: cleanOptionalText(row.categoria),
    });
  }

  return resources;
}

function readSubBudgets(
  db: SqliteDatabase,
  projectId: string,
  selectedSubBudgetId: string | undefined,
  hasSubBudgets: boolean,
  hasSubBudgetColumn: boolean,
  resourcesById: Map<string, DbImportedResource>,
  warnings: Set<string>,
): DbImportedSubBudget[] {
  const rows = hasSubBudgets
    ? db.prepare(`
        SELECT id, nombre, orden
        FROM sub_presupuestos
        WHERE CAST(proyecto_id AS TEXT) = ?
          AND (? IS NULL OR CAST(id AS TEXT) = ?)
        ORDER BY orden, id
      `).all(projectId, selectedSubBudgetId ?? null, selectedSubBudgetId ?? null) as Array<{ id: number | string; nombre: string; orden?: number | null }>
    : [{ id: "general", nombre: "GENERAL", orden: 0 }];
  const result: DbImportedSubBudget[] = rows.map((row) => ({
    id: String(row.id),
    name: cleanText(row.nombre) || `Subpresupuesto ${row.id}`,
    order: toInteger(row.orden),
    items: [],
  }));
  const subBudgetById = new Map(result.map((row) => [row.id, row]));
  let general = subBudgetById.get("general");

  const projectItems = db.prepare(`
    SELECT p.id, p.item, p.descripcion, p.unidad, p.metrado, p.precio_unitario, p.nivel, p.es_titulo,
           ${selectColumn(db, "partidas", "rendimiento", "p")},
           ${selectColumn(db, "partidas", "grupo", "p")},
           ${hasSubBudgetColumn ? "p.sub_presupuesto_id" : "NULL AS sub_presupuesto_id"}
    FROM partidas p
    WHERE CAST(p.proyecto_id AS TEXT) = ?
      AND (${hasSubBudgetColumn ? "? IS NULL OR CAST(p.sub_presupuesto_id AS TEXT) = ? OR (? = 'general' AND p.sub_presupuesto_id IS NULL)" : "? IS NULL OR ? = 'general'"})
    ORDER BY ${hasSubBudgetColumn ? "COALESCE(p.sub_presupuesto_id, 0), " : ""}p.nivel, p.id
  `).all(...(hasSubBudgetColumn
    ? [projectId, selectedSubBudgetId ?? null, selectedSubBudgetId ?? null, selectedSubBudgetId ?? null]
    : [projectId, selectedSubBudgetId ?? null, selectedSubBudgetId ?? null])) as Array<{
    id: number | string;
    item?: string | null;
    descripcion?: string | null;
    unidad?: string | null;
    metrado?: number | string | null;
    precio_unitario?: number | string | null;
    nivel?: number | string | null;
    es_titulo?: number | string | null;
    rendimiento?: number | string | null;
    grupo?: string | null;
    sub_presupuesto_id?: number | string | null;
  }>;

  const apuRowsByPartida = readApuRowsForProject(db, projectId, resourcesById, warnings);

  for (const row of projectItems) {
    const rowSubBudgetId = row.sub_presupuesto_id == null ? "general" : String(row.sub_presupuesto_id);
    const subBudget = subBudgetById.get(rowSubBudgetId);
    if (!subBudget) {
      if (selectedSubBudgetId) continue;
      if (!general) {
        general = { id: "general", name: "GENERAL", order: Number.MAX_SAFE_INTEGER, items: [] };
        result.push(general);
        subBudgetById.set(general.id, general);
      }
      warnings.add(`La partida ${cleanText(row.item) || row.id} no tiene subpresupuesto; se asigno a GENERAL.`);
    }

    const target = subBudget ?? general;
    if (!target) continue;
    const item = readBudgetItem(row, apuRowsByPartida.get(String(row.id)) ?? []);
    target.items.push(item);
  }

  return result.filter((subBudget) => subBudget.items.length > 0 || selectedSubBudgetId != null);
}

function readBudgetItem(
  row: {
    id: number | string;
    item?: string | null;
    descripcion?: string | null;
    unidad?: string | null;
    metrado?: number | string | null;
    precio_unitario?: number | string | null;
    nivel?: number | string | null;
    es_titulo?: number | string | null;
    rendimiento?: number | string | null;
    grupo?: string | null;
  },
  apuRows: DbImportedApuRow[],
): DbImportedBudgetItem {
  const id = String(row.id);
  const code = cleanText(row.item) || `DB-ITEM-${id}`;
  const description = cleanText(row.descripcion) || code;
  const itemIsTitle = toBoolean(row.es_titulo);

  return {
    id,
    code,
    description,
    unit: normalizeUnit(row.unidad),
    quantity: decimalString(row.metrado) ?? "0",
    unitPrice: decimalString(row.precio_unitario) ?? "0",
    partial: decimalString(row.metrado != null && row.precio_unitario != null ? multiply(row.metrado, row.precio_unitario) : null) ?? "0",
    level: Math.max(1, toInteger(row.nivel) || 1),
    isTitle: itemIsTitle,
    order: toInteger(row.id),
    productivity: decimalString(row.rendimiento),
    group: cleanOptionalText(row.grupo),
    apuRows: itemIsTitle ? [] : apuRows,
  };
}

type DbApuSourceRow = {
  id: number | string;
  partida_id: number | string;
  recurso_id: number | string;
  cuadrilla?: number | string | null;
  cantidad?: number | string | null;
  precio?: number | string | null;
  codigo?: string | null;
  descripcion?: string | null;
  tipo?: string | null;
  unidad?: string | null;
  recurso_precio?: number | string | null;
  indice_inei?: string | null;
  categoria?: string | null;
};

function readApuRowsForProject(db: SqliteDatabase, projectId: string, resourcesById: Map<string, DbImportedResource>, warnings: Set<string>) {
  const rows = db.prepare(`
    SELECT ai.id, ai.partida_id, ai.recurso_id,
           ${selectColumn(db, "acu_items", "cuadrilla", "ai")},
           ai.cantidad,
           ${selectColumn(db, "acu_items", "precio", "ai")},
           r.codigo, r.descripcion, r.tipo, r.unidad, r.precio AS recurso_precio,
           ${selectColumn(db, "recursos", "indice_inei", "r")},
           ${selectColumn(db, "recursos", "categoria", "r")}
    FROM acu_items ai
    LEFT JOIN recursos r ON r.id = ai.recurso_id
    INNER JOIN partidas p ON p.id = ai.partida_id
    WHERE CAST(p.proyecto_id AS TEXT) = ?
    ORDER BY ai.partida_id, ai.id
  `).all(projectId) as DbApuSourceRow[];
  const apuRowsByPartida = new Map<string, DbImportedApuRow[]>();

  for (const row of rows) {
    const imported = mapApuRow(row, resourcesById, warnings);
    if (!imported) continue;
    const partidaRows = apuRowsByPartida.get(String(row.partida_id)) ?? [];
    partidaRows.push(imported);
    apuRowsByPartida.set(String(row.partida_id), partidaRows);
  }

  return apuRowsByPartida;
}

function mapApuRow(row: DbApuSourceRow, resourcesById: Map<string, DbImportedResource>, warnings: Set<string>): DbImportedApuRow | null {
  const resourceId = String(row.recurso_id);
  const resource = resourcesById.get(resourceId);
  if (!resource && !row.descripcion) {
    warnings.add(`No se encontro el recurso ${resourceId} de la partida ${row.partida_id}.`);
    return null;
  }

  const description = cleanText(row.descripcion) || resource?.description || `Recurso ${resourceId}`;
  const code = cleanText(row.codigo) || resource?.code || `DB-RESOURCE-${resourceId}`;
  const unit = normalizeUnit(row.unidad || resource?.unit);
  const unitPrice = decimalString(row.precio ?? row.recurso_precio ?? resource?.unitPrice) ?? "0";
  const quantity = decimalString(row.cantidad) ?? "0";
  const partial = multiply(quantity, unitPrice);
  const normalizedResource = resource ?? {
    id: resourceId,
    code,
    description,
    type: cleanText(row.tipo),
    unit,
    unitPrice,
    unifiedIndexCode: cleanOptionalText(row.indice_inei),
    category: cleanOptionalText(row.categoria),
  };
  resourcesById.set(resourceId, normalizedResource);

  return {
    id: String(row.id),
    resourceId,
    code,
    description,
    type: cleanText(row.tipo) || normalizedResource.type,
    unit,
    quantity,
    unitPrice,
    partial,
    crew: decimalString(row.cuadrilla),
  };
}

function withDatabase<T>(filePath: string, callback: (db: SqliteDatabase) => T): T {
  inspectDbFile(filePath);
  const database = openDatabase(filePath);
  try {
    return callback(database);
  } finally {
    database.close();
  }
}

function openDatabase(filePath: string) {
  try {
    const Constructor = qrequire("better-sqlite3") as SqliteConstructor;
    return new Constructor(filePath, { readonly: true, fileMustExist: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("supera el limite")) throw error;
    throw new Error("No se pudo abrir la base SQLite. Cierra la aplicacion que la usa y verifica que el archivo no este dañado.");
  }
}

function getRegularFileStats(filePath: string) {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new Error(`El archivo no existe: ${filePath}.`);
  }
  if (!stats.isFile()) throw new Error("La ruta indicada no es un archivo regular.");
  return stats;
}

function assertSupportedPath(filePath: string) {
  if (!isSupportedDbFileName(path.basename(filePath))) {
    throw new Error("El archivo debe tener extension .db, .sqlite o .sqlite3.");
  }
}

function decimalString(value: number | string | null | undefined) {
  if (value == null || String(value).trim() === "") return null;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal.toString() : null;
  } catch {
    return null;
  }
}

function multiply(left: number | string | null | undefined, right: number | string | null | undefined) {
  try {
    const result = new Decimal(left ?? 0).times(new Decimal(right ?? 0));
    return result.isFinite() ? result.toString() : "0";
  } catch {
    return "0";
  }
}

function cleanText(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanOptionalText(value: string | number | null | undefined) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeUnit(value: string | number | null | undefined) {
  const raw = cleanText(value);
  const normalized = raw.toUpperCase();
  if (normalized === "M²" || normalized === "M2") return "m2";
  if (normalized === "M³" || normalized === "M3") return "m3";
  if (normalized === "GLB" || normalized === "GLOBAL") return "glb";
  if (normalized === "UND" || normalized === "UNIDAD") return "und";
  if (normalized === "HH") return "hh";
  if (normalized === "HM") return "hm";
  if (normalized === "%MO") return "%MO";
  if (normalized === "%") return "%";
  return raw || "und";
}

function toInteger(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function inspectionHasTable(db: SqliteDatabase, table: string) {
  const row = db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function selectColumn(db: SqliteDatabase, table: string, column: string, sourceAlias: string, alias = column) {
  return hasUsableColumn(db, table, column)
    ? `${sourceAlias}.${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`
    : `NULL AS ${quoteIdentifier(alias)}`;
}

function hasUsableTable(db: SqliteDatabase, table: string, requiredColumns: readonly string[]) {
  if (!inspectionHasTable(db, table)) return false;
  return requiredColumns.every((column) => hasUsableColumn(db, table, column));
}

function hasUsableColumn(db: SqliteDatabase, table: string, column: string) {
  const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as SqliteColumn[];
  return columns.some((candidate) => candidate.name === column);
}

function toBoolean(value: number | string | null | undefined) {
  return value === 1 || value === "1" || String(value).toLowerCase() === "true";
}
