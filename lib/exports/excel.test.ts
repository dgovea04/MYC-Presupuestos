import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildResponsibleMetaRows, createApuWorkbook, createBudgetWorkbook } from "@/lib/exports/excel";
import type { BudgetRecord } from "@/types/budget";

const budgetFixture: BudgetRecord = {
  id: "budget-1",
  projectId: "project-1",
  kind: "GENERAL",
  name: "Presupuesto General",
  currency: "PEN",
  igvRate: 0.18,
  generalExpensesRate: 0.1,
  utilityRate: 0.08,
  totalDirectCost: 1500,
  totalGeneralExpenses: 150,
  totalUtility: 120,
  totalTax: 318.6,
  totalAmount: 2088.6,
  levels: [],
  items: [
    {
      id: "item-1",
      budgetId: "budget-1",
      code: "01.01",
      description: "Trazo y replanteo",
      unit: "m2",
      quantity: 10,
      unitPrice: 150,
      partial: 1500,
      sortOrder: 1,
      apu: {
        id: "apu-1",
        budgetItemId: "item-1",
        notes: null,
        resources: [
          {
            id: "apu-resource-1",
            apuId: "apu-1",
            resourceId: "resource-1",
            quantity: 2,
            crew: "1 cuadrilla" as unknown as number | null,
            unitPrice: 75,
            subtotal: 150,
            resourceType: "MATERIAL",
            resource: {
              id: "resource-1",
              code: "MAT-001",
              description: "Cemento",
              unit: "bolsa",
              unitPrice: 75,
              category: "MATERIAL",
              source: null,
              currency: "PEN",
              companyId: null,
              iu: null,
              subcategory: null,
            },
          },
        ],
      },
    },
  ],
};

describe("report excel exports", () => {
  it("builds responsible metadata rows in the expected order", () => {
    expect(
      buildResponsibleMetaRows({
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      }),
    ).toEqual([
      ["Responsable", "Maria Calderon", "Cargo", "Ingeniera Residente"],
      ["Empresa", "Constructora Andina SAC", "Telefono", "987654321"],
    ]);
  });

  it("writes responsible technical metadata into the budget workbook header", async () => {
    const workbookBuffer = await createBudgetWorkbook(
      budgetFixture,
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      {
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      },
    );
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    const sheet = workbook.getWorksheet("Presupuesto");
    expect(sheet?.getCell("A5").value).toBe("Responsable");
    expect(sheet?.getCell("B5").value).toBe("Maria Calderon");
    expect(sheet?.getCell("D5").value).toBe("Cargo");
    expect(sheet?.getCell("E5").value).toBe("Ingeniera Residente");
    expect(sheet?.getCell("A6").value).toBe("Empresa");
    expect(sheet?.getCell("B6").value).toBe("Constructora Andina SAC");
    expect(sheet?.getCell("D6").value).toBe("Telefono");
    expect(sheet?.getCell("E6").value).toBe("987654321");
  });

  it("quotes currency literals in Excel number formats", async () => {
    const workbookBuffer = await createBudgetWorkbook(budgetFixture, undefined, 2, undefined);
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    expect(workbook.getWorksheet("Presupuesto")?.getCell("E8").numFmt).toBe('"S/" #,##0.00');
  });

  it("writes responsible technical metadata into the APU workbook header", async () => {
    const workbookBuffer = await createApuWorkbook(
      budgetFixture,
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      {
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      },
    );
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    const sheet = workbook.getWorksheet("APU");
    expect(sheet?.getCell("A3").value).toBe("Responsable");
    expect(sheet?.getCell("B3").value).toBe("Maria Calderon");
    expect(sheet?.getCell("E3").value).toBe("Cargo");
    expect(sheet?.getCell("F3").value).toBe("Ingeniera Residente");
    expect(sheet?.getCell("A4").value).toBe("Empresa");
    expect(sheet?.getCell("B4").value).toBe("Constructora Andina SAC");
    expect(sheet?.getCell("E4").value).toBe("Telefono");
    expect(sheet?.getCell("F4").value).toBe("987654321");
  });

  it("writes a documentary signature block into the budget workbook footer area", async () => {
    const workbookBuffer = await createBudgetWorkbook(
      budgetFixture,
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      {
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      },
    );
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    const sheet = workbook.getWorksheet("Presupuesto");
    const values = collectWorksheetValues(sheet);

    expect(values).toContain("FIRMA DOCUMENTAL");
    expect(values).toContain("Responsable");
    expect(values).toContain("Maria Calderon");
    expect(values).toContain("Constructora Andina SAC");
    expect(values).toContain("FIRMA DEL RESPONSABLE");
    expect(values).toContain("VO. BO. / APROBACION");
    expect(values).toContain("Municipalidad");
    expect(values).toContain("Municipalidad\nVisto bueno documentario de Municipalidad");
  });

  it("writes a documentary signature block into the APU workbook footer area", async () => {
    const workbookBuffer = await createApuWorkbook(
      budgetFixture,
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      {
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      },
    );
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    const sheet = workbook.getWorksheet("APU");
    const values = collectWorksheetValues(sheet);

    expect(values).toContain("FIRMA DOCUMENTAL");
    expect(values).toContain("RESPONSABLE TECNICO");
    expect(values).toContain("Maria Calderon");
    expect(values).toContain("Ingeniera Residente");
    expect(values).toContain("Constructora Andina SAC");
    expect(values).toContain("FIRMA DEL RESPONSABLE");
    expect(values).toContain("VO. BO. / APROBACION");
    expect(values).toContain("Municipalidad");
    expect(values).toContain("Municipalidad\nVisto bueno documentario de Municipalidad");
  });
});

function collectWorksheetValues(sheet: ExcelJS.Worksheet | undefined) {
  const values: string[] = [];

  sheet?.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === "string" && cell.value.trim().length > 0) {
        values.push(cell.value);
      }
    });
  });

  return values;
}
