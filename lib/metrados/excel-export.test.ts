import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";

import { createMetradoWorkbook } from "@/lib/metrados/excel-export";
import type { MetradoSheetRecord } from "@/types/metrado";

const sheet: MetradoSheetRecord = {
  id: "sheet-1",
  userId: "user-1",
  projectId: "project-1",
  projectName: "Obra Demo",
  budgetId: "budget-1",
  budgetName: "Presupuesto Demo",
  templateId: "template-concrete",
  templateType: "CONCRETE",
  name: "Metrado de concreto",
  status: "DRAFT",
  unit: "m3",
  totalQuantity: 6,
  partidaLink: null,
  rows: [
    {
      id: "row-1",
      sheetId: "sheet-1",
      sector: "A",
      eje: "1",
      nivel: "N1",
      description: "Zapata",
      unit: "m3",
      formulaKey: "volume",
      inputs: { largo: 2, ancho: 3, alto: 1 },
      partial: 6,
      sortOrder: 1,
    },
  ],
};

describe("createMetradoWorkbook", () => {
  test("exports sheet metadata and rows", async () => {
    const buffer = await createMetradoWorkbook(sheet);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet("Metrado");
    expect(worksheet?.getCell("A1").value).toBe("METRADO AVANZADO");
    expect(worksheet?.getCell("B3").value).toBe("Obra Demo");
    expect(worksheet?.getCell("E8").value).toBe("volume");
  });
});
