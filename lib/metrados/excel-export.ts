import ExcelJS from "exceljs";

import type { MetradoFormulaInputKey, MetradoSheetRecord } from "@/types/metrado";

const inputColumns = [
  "largo",
  "ancho",
  "alto",
  "cantidad",
  "longitud",
  "pesoUnitario",
  "perimetro",
  "altura",
  "area",
  "factor",
  "manual",
] as const satisfies MetradoFormulaInputKey[];

const partialColumn = 18;

type MetradoWorksheetColumn = {
  header: string;
  key: string;
  width: number;
};

const worksheetColumns: MetradoWorksheetColumn[] = [
  { header: "Sector", key: "sector", width: 14 },
  { header: "Eje", key: "eje", width: 12 },
  { header: "Nivel", key: "nivel", width: 12 },
  { header: "Descripcion", key: "description", width: 36 },
  { header: "Formula", key: "formulaKey", width: 18 },
  { header: "Unidad", key: "unit", width: 10 },
  { header: "Largo", key: "largo", width: 10 },
  { header: "Ancho", key: "ancho", width: 10 },
  { header: "Alto", key: "alto", width: 10 },
  { header: "Cantidad", key: "cantidad", width: 12 },
  { header: "Longitud", key: "longitud", width: 12 },
  { header: "Peso unitario", key: "pesoUnitario", width: 14 },
  { header: "Perimetro", key: "perimetro", width: 12 },
  { header: "Altura", key: "altura", width: 10 },
  { header: "Area", key: "area", width: 10 },
  { header: "Factor", key: "factor", width: 10 },
  { header: "Manual", key: "manual", width: 10 },
  { header: "Parcial", key: "partial", width: 14 },
];

export async function createMetradoWorkbook(sheet: MetradoSheetRecord) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Metrado");

  workbook.creator = "MC Presupuestos";
  worksheet.views = [{ state: "frozen", ySplit: 7 }];
  worksheet.columns = worksheetColumns;

  worksheet.mergeCells("A1:R1");
  worksheet.getCell("A1").value = "METRADO AVANZADO";
  worksheet.getCell("A1").font = {
    bold: true,
    color: { argb: "FF0F172A" },
    size: 16,
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.getCell("A3").value = "Proyecto";
  worksheet.getCell("B3").value = sheet.projectName;
  worksheet.getCell("D3").value = "Presupuesto";
  worksheet.getCell("E3").value = sheet.budgetName;
  worksheet.getCell("A4").value = "Hoja";
  worksheet.getCell("B4").value = sheet.name;
  worksheet.getCell("D4").value = "Unidad";
  worksheet.getCell("E4").value = sheet.unit;

  const header = worksheet.getRow(7);
  header.values = worksheetColumns.map((column) => column.header);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  sheet.rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(index + 8);
    excelRow.getCell(1).value = row.sector;
    excelRow.getCell(2).value = row.eje;
    excelRow.getCell(3).value = row.nivel;
    excelRow.getCell(4).value = row.description;
    excelRow.getCell(5).value = row.formulaKey;
    excelRow.getCell(6).value = row.unit;
    inputColumns.forEach((key, inputIndex) => {
      excelRow.getCell(inputIndex + 7).value = row.inputs[key] ?? "";
    });
    excelRow.getCell(partialColumn).value = row.partial;
  });

  const totalRowNumber = sheet.rows.length + 9;
  worksheet.getCell(`Q${totalRowNumber}`).value = "Total";
  worksheet.getCell(`R${totalRowNumber}`).value = sheet.totalQuantity;
  worksheet.getRow(totalRowNumber).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}
