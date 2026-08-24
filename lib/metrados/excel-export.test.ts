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
  isActive: true,
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
      inputs: {
        largo: 2,
        ancho: 3,
        alto: 1,
        factor: 1.2,
        manual: 6,
      },
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
    expect(worksheet?.getCell("E3").value).toBe("Presupuesto Demo");
    expect(worksheet?.getCell("B4").value).toBe("Metrado de concreto");
    expect(worksheet?.getCell("E4").value).toBe("m3");
    expect(worksheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 7 });
    expect(worksheet?.getCell("A7").value).toBe("Sector");
    expect(worksheet?.getCell("Q7").value).toBe("Manual");
    expect(worksheet?.getCell("A8").value).toBe("A");
    expect(worksheet?.getCell("E8").value).toBe("volume");
    expect(worksheet?.getCell("P8").value).toBe(1.2);
    expect(worksheet?.getCell("Q8").value).toBe(6);
    expect(worksheet?.getCell("R8").value).toBe(6);
    expect(worksheet?.getCell("Q10").value).toBe("Total");
    expect(worksheet?.getCell("R10").value).toBe(6);
  });
});
