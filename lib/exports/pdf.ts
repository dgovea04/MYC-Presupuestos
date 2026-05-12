import PDFDocument from "pdfkit";
import { buildDisplayRows, levelTypeLabel } from "@/lib/budget/structure";
import type { BudgetRecord } from "@/types/budget";
import { calculateBudgetRecord } from "@/lib/calculations/budget";

const MAX_CURRENCY_DECIMALS = 4;

function normalizeDecimalPlaces(decimalPlaces: number) {
  if (!Number.isFinite(decimalPlaces)) {
    return 2;
  }

  const normalized = Math.trunc(decimalPlaces);
  if (normalized < 0 || normalized > MAX_CURRENCY_DECIMALS) {
    return 2;
  }

  return normalized;
}

export async function createBudgetPdf(
  budget: BudgetRecord,
  project?: { name?: string | null; clientName?: string | null; location?: string | null },
  currencyDecimals = 2,
) {
  const normalized = calculateBudgetRecord(budget);
  const rows = buildDisplayRows(normalized);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fillColor("#0f172a").fontSize(18).text("PRESUPUESTO DE OBRA", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(12).text(normalized.name, { align: "center" });
  doc.moveDown();

  doc.fontSize(10).fillColor("#334155");
  doc.text(`Proyecto: ${project?.name ?? "Sin proyecto"}`);
  doc.text(`Cliente: ${project?.clientName ?? "No definido"}`);
  doc.text(`Ubicacion: ${project?.location ?? "No definida"}`);
  doc.text(`Moneda: ${normalized.currency}`);
  doc.moveDown();

  drawTableHeader(doc);

  for (const row of rows) {
    ensurePage(doc);

    if (row.kind === "level") {
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9);
      doc.text(row.level.code, 36, doc.y, { width: 55 });
      doc.text(`${levelTypeLabel[row.level.type]}: ${row.level.name}`, 96 + row.depth * 12, doc.y, { width: 270 });
      doc.moveDown(0.5);
      doc.font("Helvetica");
      continue;
    }

    doc.fillColor("#334155").font("Helvetica").fontSize(8.5);
    doc.text(row.item.code, 36, doc.y, { width: 55 });
    doc.text(row.item.description, 96 + row.depth * 12, doc.y, { width: 250 });
    doc.text(row.item.unit, 355, doc.y, { width: 35, align: "center" });
    doc.text(row.item.quantity.toFixed(normalizedDecimals), 395, doc.y, { width: 55, align: "right" });
    doc.text(row.item.unitPrice.toFixed(normalizedDecimals), 455, doc.y, { width: 60, align: "right" });
    doc.text(row.item.partial.toFixed(normalizedDecimals), 520, doc.y, { width: 55, align: "right" });
    doc.moveDown(0.55);
  }

  doc.moveDown();
  const summaryX = 360;
  drawSummaryLine(doc, summaryX, "Costo directo", normalized.totals.totalDirectCost, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "Gastos generales", normalized.totals.totalGeneralExpenses, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "Utilidad", normalized.totals.totalUtility, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "IGV", normalized.totals.totalTax, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "TOTAL", normalized.totals.totalAmount, true, normalizedDecimals);

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  doc.rect(36, doc.y, 555, 18).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
  const y = doc.y + 5;
  doc.text("Codigo", 40, y, { width: 50 });
  doc.text("Descripcion", 96, y, { width: 250 });
  doc.text("Und.", 355, y, { width: 35, align: "center" });
  doc.text("Metrado", 395, y, { width: 55, align: "right" });
  doc.text("P.Unit", 455, y, { width: 60, align: "right" });
  doc.text("Parcial", 520, y, { width: 55, align: "right" });
  doc.moveDown(1.5);
}

function drawSummaryLine(
  doc: PDFKit.PDFDocument,
  x: number,
  label: string,
  value: number,
  strong = false,
  currencyDecimals = 2,
) {
  const y = doc.y;
  if (strong) {
    doc.rect(x, y - 2, 190, 18).fill("#0f172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold");
  } else {
    doc.fillColor("#0f172a").font("Helvetica-Bold");
  }

  doc.text(label, x + 8, y, { width: 90 });
  doc.text(value.toFixed(currencyDecimals), x + 95, y, { width: 85, align: "right" });
  doc.moveDown(0.6);
  doc.fillColor("#334155").font("Helvetica");
}

function ensurePage(doc: PDFKit.PDFDocument) {
  if (doc.y > 730) {
    doc.addPage();
    drawTableHeader(doc);
  }
}
