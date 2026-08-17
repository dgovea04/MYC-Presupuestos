import ExcelJS from "exceljs";

type ExportableResource = {
  id: string;
  code: string;
  description: string;
  unit: string;
  currency: string;
  unitPrice: string;
  priceObservedAt: Date | null;
  priceSource: string | null;
  source: string | null;
};

const HEADER_FILL = "FF2563EB";
const INSTRUCTIONS_FILL = "FF0F172A";

export async function createLocalResourcePriceTemplate() {
  const workbook = createWorkbook();
  addPriceColumns(workbook.addWorksheet("Precios"));
  addInstructionsSheet(workbook);
  return workbook.xlsx.writeBuffer();
}

export async function createGlobalResourcePriceExport(resources: ExportableResource[]) {
  const workbook = createWorkbook();
  const worksheet = workbook.addWorksheet("Precios");
  addPriceColumns(worksheet);

  for (const resource of resources) {
    worksheet.addRow({
      resourceId: resource.id,
      code: resource.code,
      description: resource.description,
      unit: resource.unit,
      currency: resource.currency,
      unitPrice: resource.unitPrice,
      observedAt: resource.priceObservedAt?.toISOString() ?? "",
      source: resource.priceSource ?? resource.source ?? "",
      notes: "",
    });
  }

  worksheet.autoFilter = `A1:I${Math.max(1, resources.length + 1)}`;
  return workbook.xlsx.writeBuffer();
}

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MC Presupuestos";
  workbook.created = new Date();
  return workbook;
}

function addPriceColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns = [
    { header: "resourceId", key: "resourceId", width: 28 },
    { header: "code", key: "code", width: 20 },
    { header: "description", key: "description", width: 46 },
    { header: "unit", key: "unit", width: 14 },
    { header: "currency", key: "currency", width: 12 },
    { header: "unitPrice", key: "unitPrice", width: 16 },
    { header: "observedAt", key: "observedAt", width: 24 },
    { header: "source", key: "source", width: 34 },
    { header: "notes", key: "notes", width: 44 },
  ];
  styleHeader(worksheet, HEADER_FILL);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addInstructionsSheet(workbook: ExcelJS.Workbook) {
  const worksheet = workbook.addWorksheet("Instrucciones");
  worksheet.columns = [{ header: "Campo", key: "field", width: 24 }, { header: "Descripción", key: "description", width: 100 }];
  worksheet.addRows([
    { field: "resourceId", description: "ID interno estable del catálogo. Recomendado para evitar ambigüedades." },
    { field: "code", description: "Código del insumo. Se usa como segundo criterio de matching." },
    { field: "description", description: "Descripción del insumo; se usa como respaldo junto con unit." },
    { field: "unit", description: "Unidad exacta del catálogo, por ejemplo kg, bol, m3 o hh." },
    { field: "currency", description: "Código ISO de moneda. Inicialmente PEN." },
    { field: "unitPrice", description: "Precio no negativo con máximo cuatro decimales. No usar símbolos de moneda." },
    { field: "observedAt", description: "Fecha ISO de observación, por ejemplo 2026-08-18T00:00:00.000Z." },
    { field: "source", description: "Fuente o evidencia del precio." },
    { field: "notes", description: "Observaciones para la revisión administrativa." },
  ]);
  styleHeader(worksheet, INSTRUCTIONS_FILL);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function styleHeader(worksheet: ExcelJS.Worksheet, fill: string) {
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
}
