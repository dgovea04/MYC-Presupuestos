import { describe, expect, it } from "vitest";
import { convertDbProjectToS10Snapshot } from "@/lib/db-import/snapshot-mapper";
import type { DbImportedProject } from "@/lib/db-import/types";
import { parseS10SnapshotValue } from "@/lib/s10/snapshot-contract";

const project: DbImportedProject = {
  id: "1",
  name: "Proyecto .db",
  client: null,
  location: null,
  currency: "Soles",
  generalExpensesRate: "10",
  utilityRate: "5",
  taxRate: "18",
  resources: [],
  warnings: [],
  subBudgets: [{
    id: "1",
    name: "Estructuras",
    order: 1,
    items: [
      { id: "title", code: "01", description: "Estructuras", unit: "", quantity: "0", unitPrice: "0", partial: "0", level: 1, isTitle: true, order: 1, productivity: null, group: null, apuRows: [] },
      { id: "item", code: "01.01", description: "Concreto", unit: "m3", quantity: "2", unitPrice: "100", partial: "200", level: 2, isTitle: false, order: 2, productivity: "1", group: null, apuRows: [{ id: "apu", resourceId: "resource", code: "MAT-01", description: "Cemento", type: "MAT", unit: "bol", quantity: "2", unitPrice: "30", partial: "60", crew: null }] },
    ],
  }],
};

describe("convertDbProjectToS10Snapshot", () => {
  it("creates a valid DB snapshot with hierarchy, APU and footer", () => {
    const snapshot = convertDbProjectToS10Snapshot(project);
    const parsed = parseS10SnapshotValue({ schema: "mc.s10.snapshot", contractVersion: "1.0.0", exportedAt: new Date().toISOString(), source: { system: "S10", adapter: "db", databaseName: "SQLite .db", budgetCode: "DB" }, payload: snapshot });

    expect(parsed.snapshot.presupuestos[0]?.CodPresupuesto).toBe("DB");
    expect(parsed.snapshot.presupuestos[0]?.CostoOferta1).toBe(271.4);
    expect(parsed.snapshot.subpresupuestos[0]?.Descripcion).toBe("Estructuras");
    expect(parsed.snapshot.budgetLevels).toHaveLength(1);
    expect(parsed.snapshot.partidas).toHaveLength(1);
    expect(parsed.snapshot.apuDetalles[0]?.CodInsumo).toBe("MAT-01");
    expect(parsed.snapshot.resultadoPieSubpresupuestos?.some((row) => row.Linea === "06")).toBe(true);
    expect(project.warnings).toContain("Los totales del pie se reconstruyeron a partir de los parciales de las partidas porque el schema .db no expone totales oficiales del proyecto.");
  });
});
