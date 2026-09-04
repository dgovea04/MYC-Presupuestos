import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listDbProjects, readDbProject } from "@/lib/db-import/sqlite-reader";

let tempDirectory = "";
let databasePath = "";

function createDatabase() {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "myc-db-import-test-"));
  databasePath = path.join(tempDirectory, "fixture.db");
  const db = new Database(databasePath);
  db.exec(`
    CREATE TABLE proyectos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, cliente TEXT, ubicacion TEXT, moneda TEXT, gf_pct REAL, utilidad_pct REAL, igv_pct REAL);
    CREATE TABLE sub_presupuestos (id INTEGER PRIMARY KEY, proyecto_id INTEGER NOT NULL, nombre TEXT NOT NULL, orden INTEGER DEFAULT 0);
    CREATE TABLE partidas (id INTEGER PRIMARY KEY, proyecto_id INTEGER NOT NULL, item TEXT NOT NULL, descripcion TEXT NOT NULL, unidad TEXT, metrado REAL, precio_unitario REAL, nivel INTEGER, es_titulo INTEGER, rendimiento REAL, grupo TEXT, sub_presupuesto_id INTEGER);
    CREATE TABLE recursos (id INTEGER PRIMARY KEY, codigo TEXT, descripcion TEXT NOT NULL, tipo TEXT NOT NULL, unidad TEXT, precio REAL, indice_inei TEXT, categoria TEXT);
    CREATE TABLE acu_items (id INTEGER PRIMARY KEY, partida_id INTEGER NOT NULL, recurso_id INTEGER NOT NULL, cuadrilla REAL, cantidad REAL, precio REAL);
    INSERT INTO proyectos VALUES (1, 'Proyecto Fixture', 'Cliente', 'Lima', 'Soles', 10, 5, 18);
    INSERT INTO sub_presupuestos VALUES (1, 1, 'Estructuras', 1);
    INSERT INTO recursos VALUES (1, 'MAT-01', 'Cemento', 'MAT', 'BOL', 30, 'IU-01', 'Materiales');
    INSERT INTO recursos VALUES (2, 'MO-01', 'Operario', 'MO', 'HH', 20, NULL, 'Mano de obra');
    INSERT INTO partidas VALUES (1, 1, '01', 'Titulo', '', 0, 0, 1, 1, 1, '', 1);
    INSERT INTO partidas VALUES (2, 1, '01.01', 'Concreto', 'm3', 2, 100, 2, 0, 1, '', 1);
    INSERT INTO partidas VALUES (3, 1, '01.02', 'Trabajo', 'm2', 3, 20, 2, 0, 1, '', 1);
    INSERT INTO acu_items VALUES (1, 2, 1, 0, 2, NULL);
    INSERT INTO acu_items VALUES (2, 2, 2, 1, 1, 20);
  `);
  db.close();
}

describe("db-import sqlite-reader", () => {
  beforeEach(createDatabase);
  afterEach(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  it("lists project and subbudget counts", () => {
    expect(listDbProjects(databasePath)).toEqual([{
      id: "1",
      name: "Proyecto Fixture",
      subBudgetCount: 1,
      itemCount: 2,
      subBudgets: [{ id: "1", name: "Estructuras", itemCount: 2 }],
    }]);
  });

  it("reads titles, items, APUs and resource price fallback", () => {
    const result = readDbProject(databasePath, "1");
    expect(result.inspection.status).toBe("compatible");
    expect(result.project.subBudgets[0]?.items.map((item) => item.isTitle)).toEqual([true, false, false]);
    expect(result.project.subBudgets[0]?.items[1]?.apuRows[0]?.unitPrice).toBe("30");
    expect(result.project.subBudgets[0]?.items[1]?.apuRows[0]?.partial).toBe("60");
    expect(result.project.warnings).toEqual([]);
  });

  it("rejects a non-SQLite file", () => {
    const invalidPath = path.join(tempDirectory, "invalid.db");
    fs.writeFileSync(invalidPath, "not sqlite");
    expect(() => listDbProjects(invalidPath)).toThrow("firma SQLite");
  });

  it("rejects an incompatible schema", () => {
    const invalidPath = path.join(tempDirectory, "other.db");
    const db = new Database(invalidPath);
    db.exec("CREATE TABLE proyectos (id INTEGER, nombre TEXT)");
    db.close();
    expect(() => listDbProjects(invalidPath)).toThrow("Faltan");
  });
});
