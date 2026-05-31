import { describe, expect, it } from "vitest";

import type { MetradoRowRecord } from "@/types/metrado";

import {
  addMetradoRow,
  buildDefaultMetradoSheetName,
  buildMetradoSheetSelectPlaceholder,
  buildMetradoTemplatePrefillMessage,
  buildNewMetradoSheetDraft,
  deleteMetradoRow,
  duplicateMetradoRow,
  parseMetradoTemplateTypeParam,
  updateMetradoRowInput,
} from "./metrado-view-model";

const baseRow = (
  overrides: Partial<MetradoRowRecord> = {},
): MetradoRowRecord => ({
  id: "row-1",
  sheetId: "sheet-1",
  sector: "Sector A",
  eje: "Eje 1",
  nivel: "Nivel 1",
  description: "Zapata",
  unit: "m3",
  formulaKey: "volume",
  inputs: {
    largo: 2,
    ancho: 1,
    alto: 0.5,
    cantidad: 1,
  },
  partial: 1,
  sortOrder: 1,
  ...overrides,
});

describe("metrado editor view model", () => {
  it("adds a blank row at the end and resequences sort order", () => {
    const rows = [
      baseRow({ id: "row-1", sortOrder: 10 }),
      baseRow({ id: "row-2", sortOrder: 30 }),
    ];

    const result = addMetradoRow(rows, "sheet-1", "m2", "area");

    expect(result).toHaveLength(3);
    expect(result.map((row) => row.sortOrder)).toEqual([1, 2, 3]);
    expect(result[2]).toMatchObject({
      sheetId: "sheet-1",
      sector: "",
      eje: "",
      nivel: "",
      description: "",
      unit: "m2",
      formulaKey: "area",
      inputs: {},
      partial: 0,
      sortOrder: 3,
    });
    expect(result[2]?.id).not.toBe("");
    expect(result[2]?.id).not.toBe("row-1");
  });

  it("duplicates a row after the source row with reset partial and a new id", () => {
    const rows = [
      baseRow({ id: "row-1", sortOrder: 1 }),
      baseRow({ id: "row-2", description: "Columna", sortOrder: 2 }),
    ];

    const result = duplicateMetradoRow(rows, "row-1");

    expect(result).toHaveLength(3);
    expect(result.map((row) => row.sortOrder)).toEqual([1, 2, 3]);
    expect(result[1]).toMatchObject({
      sheetId: "sheet-1",
      sector: "Sector A",
      eje: "Eje 1",
      nivel: "Nivel 1",
      description: "Zapata",
      unit: "m3",
      formulaKey: "volume",
      inputs: {
        largo: 2,
        ancho: 1,
        alto: 0.5,
        cantidad: 1,
      },
      partial: 0,
      sortOrder: 2,
    });
    expect(result[1]?.id).not.toBe("row-1");
  });

  it("returns resequenced rows unchanged when duplicating an unknown row", () => {
    const rows = [
      baseRow({ id: "row-1", sortOrder: 10 }),
      baseRow({ id: "row-2", sortOrder: 20 }),
    ];

    const result = duplicateMetradoRow(rows, "missing-row");

    expect(result).toHaveLength(2);
    expect(result.map((row) => row.id)).toEqual(["row-1", "row-2"]);
    expect(result.map((row) => row.sortOrder)).toEqual([1, 2]);
  });

  it("deletes a row and resequences remaining rows", () => {
    const rows = [
      baseRow({ id: "row-1", sortOrder: 1 }),
      baseRow({ id: "row-2", sortOrder: 2 }),
      baseRow({ id: "row-3", sortOrder: 3 }),
    ];

    const result = deleteMetradoRow(rows, "row-2");

    expect(result.map((row) => row.id)).toEqual(["row-1", "row-3"]);
    expect(result.map((row) => row.sortOrder)).toEqual([1, 2]);
  });

  it("returns resequenced rows unchanged when deleting an unknown row", () => {
    const rows = [
      baseRow({ id: "row-1", sortOrder: 3 }),
      baseRow({ id: "row-2", sortOrder: 8 }),
    ];

    const result = deleteMetradoRow(rows, "missing-row");

    expect(result.map((row) => row.id)).toEqual(["row-1", "row-2"]);
    expect(result.map((row) => row.sortOrder)).toEqual([1, 2]);
  });

  it("updates a formula input without mutating the original rows", () => {
    const rows = [baseRow({ id: "row-1" })];

    const result = updateMetradoRowInput(rows, "row-1", "alto", 1.25);

    expect(result[0]?.inputs.alto).toBe(1.25);
    expect(rows[0]?.inputs.alto).toBe(0.5);
    expect(result[0]).not.toBe(rows[0]);
    expect(result[0]?.inputs).not.toBe(rows[0]?.inputs);
  });

  it("ignores input updates for unknown rows", () => {
    const rows = [baseRow({ id: "row-1", sortOrder: 7 })];

    const result = updateMetradoRowInput(rows, "missing-row", "alto", 1.25);

    expect(result).toEqual([{ ...rows[0], sortOrder: 1 }]);
    expect(result[0]).not.toBe(rows[0]);
  });

  it("builds descriptive default sheet names from template and partida", () => {
    expect(buildDefaultMetradoSheetName({ templateName: "Concreto", partidaCode: "01.02.03" })).toBe(
      "Metrado - Concreto - 01.02.03",
    );
    expect(buildDefaultMetradoSheetName({ templateName: "Concreto" })).toBe("Metrado - Concreto");
  });

  it("builds a prefill message when opening a metrado template from the library", () => {
    expect(buildMetradoTemplatePrefillMessage("Concreto")).toBe(
      "Plantilla Concreto preseleccionada. Completa proyecto, presupuesto y partida para crear la hoja.",
    );
    expect(buildMetradoTemplatePrefillMessage("  ")).toBe("");
  });

  it("labels the sheet selector placeholder according to creation state", () => {
    expect(buildMetradoSheetSelectPlaceholder({ hasSheets: true, isCreatingSheet: true })).toBe(
      "Nueva hoja en configuracion",
    );
    expect(buildMetradoSheetSelectPlaceholder({ hasSheets: true, isCreatingSheet: false })).toBe("Seleccionar hoja");
    expect(buildMetradoSheetSelectPlaceholder({ hasSheets: false, isCreatingSheet: true })).toBe("Sin hojas guardadas");
  });

  it("parses metrado template ids from library links", () => {
    expect(parseMetradoTemplateTypeParam("metrado-concrete")).toBe("CONCRETE");
    expect(parseMetradoTemplateTypeParam("metrado-roofing")).toBe("ROOFING");
    expect(parseMetradoTemplateTypeParam("CUSTOM")).toBe("CUSTOM");
    expect(parseMetradoTemplateTypeParam("bad-template")).toBeNull();
  });

  it("keeps the current project and budget but clears partida when starting a new sheet", () => {
    expect(
      buildNewMetradoSheetDraft({
        budgets: [
          { id: "budget-1", projectId: "project-1" },
          { id: "budget-2", projectId: "project-2" },
        ],
        currentBudgetId: "budget-1",
        currentProjectId: "project-1",
        defaultProjectId: "project-2",
        templateDefaultUnit: "m3",
        templateName: "Personalizado",
        templateType: "CUSTOM",
      }),
    ).toEqual({
      budgetId: "budget-1",
      partidaId: "",
      projectId: "project-1",
      sheetName: "Metrado - Personalizado",
      sheetUnit: "m3",
      templateType: "CUSTOM",
    });
  });
});
