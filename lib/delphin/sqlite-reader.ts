import { createRequire } from "node:module";
import fs from "node:fs";
import type {
  DelphinAnalysis,
  DelphinBudget,
  DelphinComposition,
  DelphinCost,
  DelphinDecodedProject,
  DelphinSubtotal,
  DelphinUnit,
} from "@/lib/delphin/dprj-import";
import { convertDelphinProjectToS10Snapshot } from "@/lib/delphin/dprj-import";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const qrequire = createRequire(import.meta.url);

interface SqliteStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

interface SqliteDb {
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type SqliteConstructor = new (path: string, opts?: { readonly?: boolean }) => SqliteDb;

export type DelphinSqliteProject = {
  id: string;
  name: string;
  budgetCount: number;
};

function openDatabase(filePath: string): SqliteDb {
  if (!fs.existsSync(filePath)) {
    throw new Error(`El archivo no existe: ${filePath}`);
  }

  try {
    const Ctor = qrequire("better-sqlite3") as SqliteConstructor;
    return new Ctor(filePath, { readonly: true });
  } catch {
    throw new Error("El archivo no es una base de datos SQLite valida, o esta bloqueado. Asegurate de cerrar Delphin Express antes de importar.");
  }
}

export function listDelphinSqliteProjects(filePath: string): DelphinSqliteProject[] {
  const db = openDatabase(filePath);

  try {
    const projects = db
      .prepare(
        `SELECT p.id_proyecto AS id, p.nombre_proyecto AS name,
          (SELECT COUNT(*) FROM presupuesto WHERE id_proyecto = p.id_proyecto) AS budgetCount
         FROM proyecto p
         ORDER BY p.nombre_proyecto`,
      )
      .all() as DelphinSqliteProject[];

    return projects;
  } finally {
    db.close();
  }
}

export function exportDelphinSqliteProject(
  filePath: string,
  projectId: string,
): S10ExportSnapshot {
  const db = openDatabase(filePath);

  try {
    const project = readProject(db, projectId);
    const units = readUnits(db);
    const budgets = readBudgets(db, projectId, units);

    const decoded: DelphinDecodedProject = {
      project: { id: project.id, name: project.name },
      units,
      budgets,
    };

    const snapshot = convertDelphinProjectToS10Snapshot(decoded, project.name);
    return snapshot;
  } finally {
    db.close();
  }
}

// ── Internal readers ──────────────────────────────────────────────

function readProject(db: SqliteDb, projectId: string) {
  const row = db
    .prepare("SELECT id_proyecto AS id, nombre_proyecto AS name FROM proyecto WHERE id_proyecto = ?")
    .get(projectId) as { id: string; name: string } | undefined;

  if (!row) {
    throw new Error(`Proyecto no encontrado: ${projectId}`);
  }

  return row;
}

function readUnits(db: SqliteDb): DelphinUnit[] {
  return (db
    .prepare("SELECT id_unidad AS id, descripcion_unidad AS description, abreviatura_unidad AS abbreviation FROM unidad")
    .all() as Pick<DelphinUnit, "id" | "description" | "abbreviation">[])
    .map((row) => ({
      id: row.id ?? null,
      description: row.description ?? null,
      abbreviation: row.abbreviation ?? null,
    }));
}

function readBudgets(db: SqliteDb, projectId: string, units: DelphinUnit[]): DelphinBudget[] {
  const budgets = db
    .prepare(
      `SELECT id_presupuesto AS id, nombre_presupuesto AS name,
        costo_directo AS directCost, total_presupuesto AS total,
        porcentaje_gasto AS generalExpensesRate, monto_gasto AS generalExpensesAmount,
        porcentaje_utilidad AS utilityRate, monto_utilidad AS utilityAmount,
        porcentaje_igv AS taxRate, monto_igv AS taxAmount,
        parcial_presupuesto AS subtotal
       FROM presupuesto
       WHERE id_proyecto = ?
       ORDER BY posicion_presupuesto`,
    )
    .all(projectId) as Array<DelphinBudget & { id: string }>;

  return budgets.map((budget) => {
    const costs = readCostTree(db, budget.id, units);
    return {
      id: budget.id,
      name: budget.name,
      directCost: budget.directCost,
      total: budget.total,
      generalExpensesRate: budget.generalExpensesRate,
      generalExpensesAmount: budget.generalExpensesAmount,
      utilityRate: budget.utilityRate,
      utilityAmount: budget.utilityAmount,
      taxRate: budget.taxRate,
      taxAmount: budget.taxAmount,
      subtotal: budget.subtotal,
      costs,
    };
  });
}

type SqliteCostoRow = {
  id_costounitario: string;
  descripcion_costo: string | null;
  id_unidad: string | null;
  numeracion_costo: string | null;
  productividad: number | null;
  costo_unitario: number | null;
  cantidad: number | null;
  parcial_costo: number | null;
  id_analisiscosto: string | null;
  id_costopadre: string | null;
};

function readCostTree(
  db: SqliteDb,
  budgetId: string,
  units: DelphinUnit[],
): DelphinCost[] {
  const allRows = db
    .prepare(
      `SELECT id_costounitario, descripcion_costo, id_unidad, numeracion_costo,
        productividad, costo_unitario, cantidad, parcial_costo,
        id_analisiscosto, id_costopadre
       FROM costo_unitario
       WHERE id_presupuesto = ?
       ORDER BY posicion_costo`,
    )
    .all(budgetId) as SqliteCostoRow[];

  // Build a map for fast lookup
  const byId = new Map<string, SqliteCostoRow>();
  for (const row of allRows) {
    byId.set(row.id_costounitario, row);
  }

  // Root costs are those with id_costopadre IS NULL
  const roots = allRows.filter((r) => !r.id_costopadre);
  return roots.map((root) => buildCostNode(root, byId, db, units));
}

function buildCostNode(
  row: SqliteCostoRow,
  byId: Map<string, SqliteCostoRow>,
  db: SqliteDb,
  units: DelphinUnit[],
): DelphinCost {
  // Delphin stores some imported/catalog partidas without an analysis id.
  // A unit-bearing cost row is still a partida and must retain its APU data.
  const isPartida = Boolean(row.id_analisiscosto) || Boolean(row.id_unidad);

  const analysis: DelphinAnalysis | null = isPartida
    ? {
        productivity: row.productividad,
        subtotals: readSubtotalsForCosto(db, row.id_costounitario),
      }
    : null;

  const subtotals: DelphinSubtotal[] = isPartida
    ? readSubtotalsForCosto(db, row.id_costounitario)
    : [];

  // Find children
  const childRows = [...byId.values()].filter((r) => r.id_costopadre === row.id_costounitario);
  const children = childRows.map((child) => buildCostNode(child, byId, db, units));

  return {
    id: row.id_costounitario,
    description: row.descripcion_costo,
    unitId: isPartida ? row.id_unidad : null,
    code: row.numeracion_costo,
    productivity: row.productividad,
    unitPrice: row.costo_unitario,
    quantity: isPartida ? row.cantidad : null,
    partial: isPartida ? row.parcial_costo : null,
    analysisId: isPartida ? row.id_analisiscosto : null,
    analysis,
    subtotals,
    children,
  };
}

function readSubtotalsForCosto(
  db: SqliteDb,
  costoId: string,
): DelphinSubtotal[] {
  const subs = db
    .prepare(
      `SELECT st.id_subtotal AS id, st.id_tipocosto AS typeId, st.subtotal
       FROM subtotal_costounitario st
       WHERE st.id_costounitario = ?
         AND (st.id_composicionpadre IS NULL OR trim(st.id_composicionpadre) = '')`,
    )
    .all(costoId) as Array<{ id: string; typeId: string; subtotal: number }>;

  return subs.map((sub) => {
    const compositions = readCompositions(db, sub.id);
    return {
      typeId: sub.typeId,
      subtotal: sub.subtotal,
      compositions,
    };
  });
}

function readCompositions(
  db: SqliteDb,
  subtotalId: string,
): DelphinComposition[] {
  const comps = db
    .prepare(
      `SELECT cc.id_composicion AS id, cc.descripcion_composicion AS description,
        cc.id_unidad AS unitId, cc.cantidad_composicion AS quantity,
        cc.costo_composicion AS unitPrice, cc.parcial_composicion AS partial,
        lp.codigo_crepco AS resourceCode, cc.id_listaprecio AS listPriceId
       FROM composicion_costounitario cc
       LEFT JOIN lista_precio lp ON cc.id_listaprecio = lp.id_listaprecio
       WHERE cc.id_subtotal = ?`,
    )
    .all(subtotalId) as Array<{
      id: string;
      description: string;
      unitId: string | null;
      quantity: number;
      unitPrice: number;
      partial: number;
      resourceCode: string | null;
      listPriceId: string | null;
    }>;

  return comps.map((comp) => ({
    id: comp.id,
    description: comp.description,
    unitId: comp.unitId,
    quantity: comp.quantity,
    unitPrice: comp.unitPrice,
    partial: comp.partial,
    resourceCode: comp.resourceCode,
    listPriceId: comp.listPriceId,
  }));
}