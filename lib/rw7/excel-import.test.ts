import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRw7WorkbookToS10Snapshot } from "@/lib/rw7/excel-import";
import { createMycImportDraftFromS10 } from "@/lib/s10/import-mapper";

describe("parseRw7WorkbookToS10Snapshot", () => {
  it("maps a Sistemas RW7 Excel export into an importable MYC draft", async () => {
    const buffer = readFileSync(resolve("presupuesto-ejemplo/rw7/Centro-Educativo-en-RW7o.xlsx"));
    const snapshot = await parseRw7WorkbookToS10Snapshot({
      buffer,
      fileName: "Centro-Educativo-en-RW7o.xlsx",
    });
    const draft = createMycImportDraftFromS10(snapshot, { sourceSystem: "RW7" });

    expect(snapshot.presupuestos).toHaveLength(1);
    expect(snapshot.partidas).toHaveLength(94);
    expect(snapshot.subpresupuestoDetalles).toHaveLength(94);
    expect(snapshot.apuDetalles).toHaveLength(646);
    expect(draft.source).toBe("RW7");
    expect(draft.resources.length).toBeGreaterThan(150);
    expect(snapshot.subpresupuestos[0]).toMatchObject({
      CodSubpresupuesto: "01",
      Descripcion: "ESTRUCTURAS",
    });
    expect(draft.budgets.length).toBeGreaterThan(2);
    const estructurasBudget = draft.budgets.find((budget) => budget.kind === "SUB_BUDGET" && budget.name === "ESTRUCTURAS");
    expect(estructurasBudget?.items[0]).toMatchObject({
      code: "01.01.01",
      description: "TRAZO Y REPLANTEO INICIAL",
      unit: "m2",
      quantity: 200,
      unitPrice: 3.02,
    });
    const concretoSimple = estructurasBudget?.levels.find((level) => level.code === "01.05");
    const solados = estructurasBudget?.levels.find((level) => level.code === "01.05.01");
    const soladoItem = estructurasBudget?.items.find((item) => item.code === "01.05.01.01");

    expect(concretoSimple).toMatchObject({
      name: "CONCRETO SIMPLE",
      type: "TITLE",
      parentId: null,
    });
    expect(solados).toMatchObject({
      name: "SOLADOS",
      type: "SUBTITLE",
      parentId: concretoSimple?.id,
    });
    expect(soladoItem).toMatchObject({
      description: "SOLADO e=3\"",
      levelId: solados?.id,
    });
    expect(draft.itemMetadata.filter((metadata) => metadata.apuStatus !== "OK")).toHaveLength(0);
  }, 20000);
});
