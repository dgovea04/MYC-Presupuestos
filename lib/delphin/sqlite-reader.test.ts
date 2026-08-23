import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportDelphinSqliteProject, listDelphinSqliteProjects } from "@/lib/delphin/sqlite-reader";

let tempDir: string;
let tempPath: string;

function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "myc-delphin-test-"));
  tempPath = path.join(tempDir, "test.sqlite");
  const db = new Database(tempPath);

  // Create tables matching Delphin schema
  db.exec(`
    CREATE TABLE proyecto (
      id_proyecto CHAR(12) PRIMARY KEY NOT NULL,
      nombre_proyecto VARCHAR(255) NOT NULL
    );
    CREATE TABLE presupuesto (
      id_presupuesto CHAR(12) PRIMARY KEY NOT NULL,
      nombre_presupuesto VARCHAR(255),
      costo_directo NUMERIC(20, 6),
      porcentaje_gasto NUMERIC(16, 10),
      monto_gasto NUMERIC(20, 6),
      porcentaje_utilidad NUMERIC(16, 2),
      monto_utilidad NUMERIC(16, 2),
      porcentaje_igv NUMERIC(16, 2),
      monto_igv NUMERIC(16, 2),
      parcial_presupuesto NUMERIC(16, 2),
      total_presupuesto NUMERIC(16, 2),
      id_proyecto CHAR(12) NOT NULL,
      posicion_presupuesto INTEGER
    );
    CREATE TABLE unidad (
      id_unidad CHAR(12) PRIMARY KEY NOT NULL,
      descripcion_unidad VARCHAR(120),
      abreviatura_unidad VARCHAR(30)
    );
    CREATE TABLE costo_unitario (
      id_costounitario CHAR(12) PRIMARY KEY NOT NULL,
      descripcion_costo VARCHAR(255),
      id_unidad CHAR(12),
      numeracion_costo VARCHAR(120),
      productividad NUMERIC(16, 2),
      costo_unitario NUMERIC(16, 2),
      cantidad NUMERIC(16, 2),
      parcial_costo NUMERIC(16, 2),
      id_analisiscosto CHAR(12),
      id_presupuesto CHAR(12),
      id_costopadre CHAR(12),
      posicion_costo INTEGER
    );
    CREATE TABLE subtotal_costounitario (
      id_subtotal CHAR(12) PRIMARY KEY NOT NULL,
      id_costounitario CHAR(12),
      id_tipocosto VARCHAR(12),
      subtotal NUMERIC(16, 4),
      id_composicionpadre CHAR(12)
    );
    CREATE TABLE composicion_costounitario (
      id_composicion CHAR(12) PRIMARY KEY NOT NULL,
      descripcion_composicion VARCHAR(255),
      id_subtotal CHAR(12) NOT NULL,
      cantidad_composicion NUMERIC(16, 4),
      costo_composicion NUMERIC(16, 4),
      parcial_composicion NUMERIC(16, 2),
      id_unidad CHAR(12),
      id_listaprecio CHAR(12)
    );
    CREATE TABLE tipo_costo (
      id_tipocosto CHAR(12) PRIMARY KEY NOT NULL,
      descripcion_tipocosto CHAR(20)
    );
    CREATE TABLE lista_precio (
      id_listaprecio CHAR(12) PRIMARY KEY NOT NULL,
      codigo_crepco VARCHAR(50),
      descripcion_listaprecio VARCHAR(255)
    );
  `);

  // Insert test data
  db.exec(`
    INSERT INTO proyecto VALUES ('PR0000000001', 'Proyecto Test');
    INSERT INTO unidad VALUES ('UN0000000001', 'Metro', 'm');
    INSERT INTO unidad VALUES ('UN0000000002', 'Metro cúbico', 'm3');
    INSERT INTO tipo_costo VALUES ('TC0000000001', 'MANO DE OBRA');
    INSERT INTO tipo_costo VALUES ('TC0000000002', 'MATERIALES');
    INSERT INTO tipo_costo VALUES ('TC0000000003', 'EQUIPO');

    -- Budget
    INSERT INTO presupuesto VALUES ('PP0000000001', 'Presupuesto 1', 50000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 50000, 'PR0000000001', 1);

    -- Root container (title)
    INSERT INTO costo_unitario VALUES ('CU0000000001', 'ESTRUCTURAS', NULL, '01', NULL, NULL, NULL, NULL, NULL, 'PP0000000001', NULL, 1);

    -- Partida 1: Excavación
    INSERT INTO costo_unitario VALUES ('CU0000000002', 'Excavación de zanja', 'UN0000000001', '01.01', 3, 25.50, 100, 2550, 'AC0000000001', 'PP0000000001', 'CU0000000001', 2);
    INSERT INTO subtotal_costounitario VALUES ('SU0000000001', 'CU0000000002', 'TC0000000001', 15, NULL);
    INSERT INTO subtotal_costounitario VALUES ('SU0000000002', 'CU0000000002', 'TC0000000002', 7, NULL);
    INSERT INTO subtotal_costounitario VALUES ('SU0000000003', 'CU0000000002', 'TC0000000003', 3.5, NULL);
    INSERT INTO composicion_costounitario VALUES ('CC0000000001', 'Operario', 'SU0000000001', 0.5, 20, 10, 'UN0000000002', NULL);
    INSERT INTO composicion_costounitario VALUES ('CC0000000002', 'Peón', 'SU0000000001', 0.5, 10, 5, 'UN0000000002', NULL);
    INSERT INTO composicion_costounitario VALUES ('CC0000000003', 'Herramientas', 'SU0000000003', 1, 3.5, 3.5, NULL, NULL);

    -- Partida 2: Concreto (note: f''c double escaped for SQL)
    INSERT INTO costo_unitario VALUES ('CU0000000003', 'Concreto fc=210 kg/cm2', 'UN0000000002', '01.02', 20, 350.00, 10, 3500, 'AC0000000002', 'PP0000000001', 'CU0000000001', 3);
    INSERT INTO subtotal_costounitario VALUES ('SU0000000004', 'CU0000000003', 'TC0000000001', 100, NULL);
    INSERT INTO subtotal_costounitario VALUES ('SU0000000005', 'CU0000000003', 'TC0000000002', 250, NULL);
    INSERT INTO composicion_costounitario VALUES ('CC0000000004', 'Cemento', 'SU0000000005', 8, 30, 240, NULL, 'LP0000000001');
    INSERT INTO composicion_costounitario VALUES ('CC0000000005', 'Operario', 'SU0000000004', 2, 25, 50, 'UN0000000002', NULL);

    -- Resource in lista_precio
    INSERT INTO lista_precio VALUES ('LP0000000001', '301060001', 'Cemento Portland Tipo I');
  `);

  db.close();
  return tempPath;
}

describe("listDelphinSqliteProjects", () => {
  beforeEach(() => {
    createTestDatabase();
  });

  afterEach(() => {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // File may still be locked; don't fail the test for cleanup issues
      }
    }
  });

  it("lists all projects with their budget count", () => {
    const projects = listDelphinSqliteProjects(tempPath);
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe("PR0000000001");
    expect(projects[0].name).toBe("Proyecto Test");
    expect(projects[0].budgetCount).toBe(1);
  });

  it("throws for a non-existent file", () => {
    expect(() => listDelphinSqliteProjects("C:/nonexistent/file.sqlite")).toThrow("El archivo no existe");
  });

  it("returns empty array when database has no projects", () => {
    const db = new Database(tempPath);
    db.exec("DELETE FROM proyecto");
    db.close();
    expect(listDelphinSqliteProjects(tempPath)).toEqual([]);
  });
});

describe("exportDelphinSqliteProject", () => {
  beforeEach(() => {
    createTestDatabase();
  });

  afterEach(() => {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // File may still be locked; don't fail the test for cleanup issues
      }
    }
  });

  it("exports a project into an S10 snapshot", () => {
    const snapshot = exportDelphinSqliteProject(tempPath, "PR0000000001");

    expect(snapshot.presupuestos).toHaveLength(1);
    expect(snapshot.presupuestos[0].CodPresupuesto).toBe("DELPHIN");
    expect(snapshot.presupuestos[0].Descripcion).toBe("Proyecto Test");
    expect(snapshot.presupuestos[0].Moneda).toBe("S/.");

    // Budget-level structure
    expect(snapshot.subpresupuestos).toHaveLength(1);
    expect(snapshot.subpresupuestos[0].CodSubpresupuesto).toBeTruthy();
    
    // Partidas
    expect(snapshot.partidas.length).toBeGreaterThanOrEqual(2);
    const excavacion = snapshot.partidas.find((p) => p.Descripcion.includes("Excavación"));
    expect(excavacion).toBeDefined();
    expect(excavacion!.Precio1).toBe(25.5);
    expect(excavacion!.CodUnidad).toBe("m");

    // APU details
    expect(snapshot.apuDetalles.length).toBeGreaterThanOrEqual(4);

    // Subpresupuesto detalles
    expect(snapshot.subpresupuestoDetalles.length).toBeGreaterThanOrEqual(2);
  });

  it("treats a unit-bearing cost without an analysis id as a partida", () => {
    const db = new Database(tempPath);
    db.prepare("UPDATE costo_unitario SET id_analisiscosto = NULL WHERE id_costounitario = ?").run("CU0000000002");
    db.close();

    const snapshot = exportDelphinSqliteProject(tempPath, "PR0000000001");
    const excavacion = snapshot.partidas.find((partida) => partida.Descripcion.includes("Excavación"));

    expect(excavacion).toBeDefined();
    expect(snapshot.subpresupuestos).toHaveLength(1);
  });

  it("ignores nested subtotals that belong to a composition", () => {
    const db = new Database(tempPath);
    db.prepare("INSERT INTO subtotal_costounitario VALUES (?, ?, ?, ?, ?)").run(
      "SU0000000006",
      "CU0000000002",
      "TC0000000002",
      999,
      "CC0000000001",
    );
    db.prepare("INSERT INTO composicion_costounitario VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "CC0000000006",
      "Nested composition",
      "SU0000000006",
      1,
      999,
      999,
      "UN0000000001",
      null,
    );
    db.close();

    const snapshot = exportDelphinSqliteProject(tempPath, "PR0000000001");
    expect(snapshot.apuDetalles.some((detalle) => detalle.Descripcion === "Nested composition")).toBe(false);
  });

  it("reuses list prices for resource codes in compositions", () => {
    const snapshot = exportDelphinSqliteProject(tempPath, "PR0000000001");
    const cementoRows = snapshot.apuDetalles.filter((a) => a.Descripcion.includes("Cemento"));
    expect(cementoRows.length).toBeGreaterThan(0);
    expect(cementoRows[0].CodInsumo).toBe("LP0000000001");
  });

  it("throws for an unknown project", () => {
    expect(() => exportDelphinSqliteProject(tempPath, "NONEXISTENT")).toThrow("Proyecto no encontrado");
  });

  it("handles projects without budgets gracefully", () => {
    // Delete all budgets
    const db = new Database(tempPath);
    db.exec("DELETE FROM presupuesto");
    db.close();

    expect(() => exportDelphinSqliteProject(tempPath, "PR0000000001")).toThrow();
  });

  it("includes footer rows when budget has rates", () => {
    const db = new Database(tempPath);
    db.exec("UPDATE presupuesto SET porcentaje_gasto = 0.1, porcentaje_utilidad = 0.05, porcentaje_igv = 0.18, costo_directo = 50000, total_presupuesto = 66500 WHERE id_presupuesto = 'PP0000000001'");
    db.close();

    const snapshot = exportDelphinSqliteProject(tempPath, "PR0000000001");
    // Should have footer rows for the budget and a general footer
    expect(snapshot.pieSubpresupuestos.length).toBeGreaterThan(0);
    expect(snapshot.resultadoPieSubpresupuestos.length).toBeGreaterThan(0);
  });
});