import ExcelJS from "exceljs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadUnifiedIndexWorkbook,
  parseUnifiedIndexWorkbook,
} from "@/lib/polynomial-formula/index-source";
import { buildUnifiedIndexSeedPayload } from "@/lib/polynomial-formula/unified-index-seed";

const WORKBOOK_PATH = path.resolve(
  process.cwd(),
  "data-for-seed",
  "formula-polinomica",
  "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
);

const addRow = (
  worksheet: ExcelJS.Worksheet,
  values: Array<string | number | null>,
): void => {
  worksheet.addRow(values);
};

const createWorkbookFixture = (): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();

  const baseSheet = workbook.addWorksheet("IUPC Dic.25(Base Dic 2025=100)");
  addRow(baseSheet, ["base"]);
  addRow(baseSheet, [""]);
  addRow(baseSheet, ["Indices unificados base"]);
  addRow(baseSheet, ["Areas"]);
  addRow(baseSheet, ["(Base : Diciembre 2025 = 100)"]);
  addRow(baseSheet, [""]);
  addRow(baseSheet, ["Cód.", "1", "2"]);
  addRow(baseSheet, ["47", "100", "100"]);
  addRow(baseSheet, ["92", "100", "100"]);

  const relationSheet = workbook.addWorksheet("Relación índices Base dic 2025");
  addRow(relationSheet, ["title"]);
  addRow(relationSheet, [""]);
  addRow(relationSheet, ["CÓDIGO", "ELEMENTO", "CÓDIGO", "ELEMENTO"]);
  addRow(relationSheet, ["47", "Mano de obra", "92", "Flete fluvial"]);
  addRow(relationSheet, ["47-1", "Mano de obra especializada", "", ""]);
  addRow(relationSheet, ["NOTAS:", "", "", ""]);

  const dictionarySheet = workbook.addWorksheet("Diccionario Alfabetico");
  addRow(dictionarySheet, ["meta"]);
  addRow(dictionarySheet, ["", "ELEMENTO", "", "IUPC", "", "ELEMENTO", "", "IUPC"]);
  addRow(dictionarySheet, ["", "Agua", "1/", "93", "", "Acero", "", "3"]);
  addRow(dictionarySheet, ["", "Arena", "", "4", "", "", "", ""]);
  addRow(dictionarySheet, ["", "NOTAS:", "", "", "", "", "", ""]);

  const januarySheet = workbook.addWorksheet("Ene_2026");
  addRow(januarySheet, ["header"]);
  addRow(januarySheet, ["Cód.", "1", "2", "3"]);
  addRow(januarySheet, ["47", "101.35", 100, "100.50"]);
  addRow(januarySheet, ["92", "(*)", "100", "99.95"]);

  const februarySheet = workbook.addWorksheet("Feb_2026");
  addRow(februarySheet, ["header"]);
  addRow(februarySheet, ["Cód.", "1", "2"]);
  addRow(februarySheet, ["47", "101.55", "100.10"]);
  addRow(februarySheet, ["92", "", "100.25"]);

  return workbook;
};

describe("parseUnifiedIndexWorkbook", () => {
  it("parses all discovered month sheets and exposes dictionary entries", () => {
    const result = parseUnifiedIndexWorkbook(createWorkbookFixture());

    expect(result.monthSheets).toEqual(["Ene_2026", "Feb_2026"]);
    expect(result.baseSheets).toContain("IUPC Dic.25(Base Dic 2025=100)");
    expect(result.baseRows).toEqual([
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "1",
        month: 12,
        year: 2025,
        value: "100",
        sourceSheet: "IUPC Dic.25(Base Dic 2025=100)",
      },
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "2",
        month: 12,
        year: 2025,
        value: "100",
        sourceSheet: "IUPC Dic.25(Base Dic 2025=100)",
      },
      {
        code: "92",
        name: "Flete fluvial",
        geographicArea: "1",
        month: 12,
        year: 2025,
        value: "100",
        sourceSheet: "IUPC Dic.25(Base Dic 2025=100)",
      },
      {
        code: "92",
        name: "Flete fluvial",
        geographicArea: "2",
        month: 12,
        year: 2025,
        value: "100",
        sourceSheet: "IUPC Dic.25(Base Dic 2025=100)",
      },
    ]);
    expect(result.dictionaryEntries).toEqual([
      {
        code: "93",
        element: "Agua",
        note: "1/",
      },
      {
        code: "3",
        element: "Acero",
        note: null,
      },
      {
        code: "4",
        element: "Arena",
        note: null,
      },
    ]);

    expect(result.indexRows).toEqual([
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "1",
        month: 1,
        year: 2026,
        value: "101.35",
        sourceSheet: "Ene_2026",
      },
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "2",
        month: 1,
        year: 2026,
        value: "100",
        sourceSheet: "Ene_2026",
      },
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "3",
        month: 1,
        year: 2026,
        value: "100.50",
        sourceSheet: "Ene_2026",
      },
      {
        code: "92",
        name: "Flete fluvial",
        geographicArea: "2",
        month: 1,
        year: 2026,
        value: "100",
        sourceSheet: "Ene_2026",
      },
      {
        code: "92",
        name: "Flete fluvial",
        geographicArea: "3",
        month: 1,
        year: 2026,
        value: "99.95",
        sourceSheet: "Ene_2026",
      },
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "1",
        month: 2,
        year: 2026,
        value: "101.55",
        sourceSheet: "Feb_2026",
      },
      {
        code: "47",
        name: "Mano de obra",
        geographicArea: "2",
        month: 2,
        year: 2026,
        value: "100.10",
        sourceSheet: "Feb_2026",
      },
      {
        code: "92",
        name: "Flete fluvial",
        geographicArea: "2",
        month: 2,
        year: 2026,
        value: "100.25",
        sourceSheet: "Feb_2026",
      },
    ]);
  });

  it("throws when a month-sheet index code is missing from the code mapping", () => {
    const workbook = createWorkbookFixture();
    const monthSheet = workbook.getWorksheet("Ene_2026");

    if (!monthSheet) {
      throw new Error("Fixture month sheet was not created");
    }

    addRow(monthSheet, ["99", "123.45", "", ""]);

    expect(() => parseUnifiedIndexWorkbook(workbook)).toThrow(
      'Missing code/name mapping for unified index "99"',
    );
  });
});

describe("loadUnifiedIndexWorkbook", () => {
  it("loads workbook sheet groups plus code dictionary and january 2026 index rows", async () => {
    const result = await loadUnifiedIndexWorkbook(WORKBOOK_PATH);

    expect(result.monthSheets).toContain("Ene_2026");
    expect(result.baseSheets).toContain("IUPC Dic.25(Base Dic 2025=100)");
    expect(result.baseRows.length).toBeGreaterThan(1000);

    expect(result.codeNameRows).toEqual(
      expect.arrayContaining([
        {
          code: "47",
          name: "Mano de obra (incluye leyes sociales)",
        },
        {
          code: "47-1",
          name: "Mano de obra de alta especialización (incluye leyes sociales) (c)",
        },
      ]),
    );

    expect(result.dictionaryEntries).toEqual(
      expect.arrayContaining([
        {
          code: "66",
          element: "Accesorio PVC-U para redes de agua",
          note: null,
        },
        {
          code: "3",
          element: "Acero corrugado ASTM A496",
          note: null,
        },
      ]),
    );
    expect(result.dictionaryEntries.length).toBeGreaterThan(100);

    expect(result.indexRows.length).toBeGreaterThan(1000);
    expect(result.indexRows).toEqual(
      expect.arrayContaining([
        {
          code: "47",
          name: "Mano de obra (incluye leyes sociales)",
          geographicArea: "1",
          month: 1,
          year: 2026,
          value: "101.35",
          sourceSheet: "Ene_2026",
        },
        {
          code: "92",
          name: "Flete fluvial (c)",
          geographicArea: "12",
          month: 1,
          year: 2026,
          value: "100",
          sourceSheet: "Ene_2026",
        },
      ]),
    );

    expect(
      result.indexRows.find(
        (row) => row.code === "92" && row.geographicArea === "1",
      ),
    ).toBeUndefined();
  });
});

describe("buildUnifiedIndexSeedPayload", () => {
  it("includes base-sheet rows and month-sheet rows in the seed payload", () => {
    const workbookSource = parseUnifiedIndexWorkbook(createWorkbookFixture());
    const payload = buildUnifiedIndexSeedPayload(
      workbookSource,
      "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
    );

    expect(payload).toContainEqual({
      code: "47",
      name: "Mano de obra",
      geographicArea: "1",
      month: 12,
      year: 2025,
      value: "100",
      source: "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
    });
    expect(payload).toContainEqual({
      code: "47",
      name: "Mano de obra",
      geographicArea: "1",
      month: 1,
      year: 2026,
      value: "101.35",
      source: "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
    });
    expect(payload).toHaveLength(12);
  });

  it("throws when duplicate composite keys disagree on seeded values", () => {
    const workbookSource = parseUnifiedIndexWorkbook(createWorkbookFixture());

    expect(() =>
      buildUnifiedIndexSeedPayload(
        {
          ...workbookSource,
          baseRows: [
            ...workbookSource.baseRows,
            {
              code: "47",
              name: "Mano de obra",
              geographicArea: "1",
              month: 12,
              year: 2025,
              value: "101",
              sourceSheet: "Conflicting Base Sheet",
            },
          ],
        },
        "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
      ),
    ).toThrow('Conflicting unified index seed rows for composite key "47:1:12:2025"');
  });

  it("keeps one payload row when duplicate composite keys are identical", () => {
    const workbookSource = parseUnifiedIndexWorkbook(createWorkbookFixture());

    const payload = buildUnifiedIndexSeedPayload(
      {
        ...workbookSource,
        baseRows: [
          ...workbookSource.baseRows,
          {
            ...workbookSource.baseRows[0],
          },
        ],
      },
      "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
    );

    expect(
      payload.filter(
        (row) =>
          row.code === "47" &&
          row.geographicArea === "1" &&
          row.month === 12 &&
          row.year === 2025,
      ),
    ).toHaveLength(1);
    expect(payload).toHaveLength(12);
  });
});
