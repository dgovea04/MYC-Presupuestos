import PDFDocument from "pdfkit";
import { buildDisplayRows, levelTypeLabel } from "@/lib/budget/structure";
import type { BudgetRecord } from "@/types/budget";
import type { ReportResponsibleMeta } from "@/types/report-meta";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { buildBudgetCoverSummary, buildDocumentSignatureSummary, type DocumentSignatureProjectMeta } from "@/lib/exports/document-signature";
import { loadReportIdentityAssets, type ReportIdentityAssets } from "@/lib/exports/report-assets";

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
  project?: DocumentSignatureProjectMeta,
  currencyDecimals = 2,
  responsible?: ReportResponsibleMeta,
) {
  const normalized = calculateBudgetRecord(budget);
  const rows = buildDisplayRows(normalized);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  const identityAssets = await loadReportIdentityAssets(responsible);

  doc.on("data", (chunk) => chunks.push(chunk));

  drawBudgetCoverPage(doc, normalized.name, normalized.currency, project, responsible, identityAssets);
  doc.addPage();

  doc.fillColor("#0f172a").fontSize(18).text("PRESUPUESTO DE OBRA", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(12).text(normalized.name, { align: "center" });
  doc.moveDown();

  doc.fontSize(10).fillColor("#334155");
  for (const line of buildResponsibleMetaLines(project, responsible)) {
    doc.text(line);
  }
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
  drawDocumentSignatureBlock(doc, normalized.name, project, responsible, identityAssets);

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export function buildResponsibleMetaLines(
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
) {
  const lines = [
    `Proyecto: ${project?.name ?? "Sin proyecto"}`,
    `Cliente: ${project?.clientName ?? "No definido"}`,
    `Ubicacion: ${project?.location ?? "No definida"}`,
  ];

  if (responsible?.name) {
    lines.push(`Responsable: ${responsible.name}`);
  }

  if (responsible?.jobTitle) {
    lines.push(`Cargo: ${responsible.jobTitle}`);
  }

  if (responsible?.phone) {
    lines.push(`Telefono: ${responsible.phone}`);
  }

  if (responsible?.companyName) {
    lines.push(`Empresa: ${responsible.companyName}`);
  }

  return lines;
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

function drawBudgetCoverPage(
  doc: PDFKit.PDFDocument,
  budgetName: string,
  currency: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
  identityAssets?: ReportIdentityAssets,
) {
  const cover = buildBudgetCoverSummary(budgetName, currency, project, responsible);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const startX = doc.page.margins.left;
  const startY = doc.page.margins.top;

  doc.roundedRect(startX, startY, pageWidth, pageHeight, 24).fillAndStroke("#f8fbff", "#dbeafe");

  if (identityAssets?.companyLogo) {
    doc.image(identityAssets.companyLogo.buffer, startX + pageWidth - 92, startY + 24, {
      fit: [64, 64],
      align: "center",
      valign: "center",
    });
  }

  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(10).text(cover.companyName, startX + 28, startY + 30, {
    width: pageWidth - 140,
  });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(28).text(cover.title, startX + 28, startY + 92, {
    width: pageWidth - 56,
  });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(20).text(cover.budgetName, startX + 28, startY + 132, {
    width: pageWidth - 56,
  });
  doc.fillColor("#475569").font("Helvetica").fontSize(13).text(cover.projectName, startX + 28, startY + 166, {
    width: pageWidth - 56,
  });

  const metadataBoxY = startY + 232;
  doc.roundedRect(startX + 24, metadataBoxY, pageWidth - 48, 120, 18).fillAndStroke("#ffffff", "#e2e8f0");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text("METADATOS DEL DOCUMENTO", startX + 42, metadataBoxY + 18);

  let metadataY = metadataBoxY + 46;
  for (const [label, value] of cover.metadata) {
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), startX + 42, metadataY, { width: 110 });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(value, startX + 154, metadataY, { width: pageWidth - 210 });
    metadataY += 18;
  }

  const signatureBoxY = metadataBoxY + 148;
  doc.roundedRect(startX + 24, signatureBoxY, pageWidth - 48, 148, 18).fillAndStroke("#ffffff", "#e2e8f0");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(cover.signatureTitle.toUpperCase(), startX + 42, signatureBoxY + 18);

  if (identityAssets?.avatar) {
    doc.image(identityAssets.avatar.buffer, startX + 42, signatureBoxY + 44, {
      fit: [54, 54],
      align: "center",
      valign: "center",
    });
  }

  const signatureTextX = identityAssets?.avatar ? startX + 112 : startX + 42;
  const signatureTextWidth = identityAssets?.avatar ? pageWidth - 182 : pageWidth - 84;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16).text(cover.signaturePrimary, signatureTextX, signatureBoxY + 50, {
    width: signatureTextWidth,
  });
  doc.fillColor("#475569").font("Helvetica").fontSize(11).text(cover.signatureSecondary, signatureTextX, signatureBoxY + 74, {
    width: signatureTextWidth,
  });

  const lineY = signatureBoxY + 114;
  doc.moveTo(startX + 42, lineY).lineTo(startX + pageWidth / 2 - 20, lineY).stroke("#94a3b8");
  doc.moveTo(startX + pageWidth / 2 + 20, lineY).lineTo(startX + pageWidth - 42, lineY).stroke("#94a3b8");
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("FIRMA DEL RESPONSABLE", startX + 42, lineY + 8, {
    width: pageWidth / 2 - 62,
    align: "center",
  });
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("VO. BO. / APROBACION", startX + pageWidth / 2 + 20, lineY + 8, {
    width: pageWidth / 2 - 62,
    align: "center",
  });

  doc.y = startY + pageHeight;
}

function drawDocumentSignatureBlock(
  doc: PDFKit.PDFDocument,
  budgetName: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
  identityAssets?: ReportIdentityAssets,
) {
  const summary = buildDocumentSignatureSummary(budgetName, project, responsible);
  const blockHeight = 228;

  if (doc.y + blockHeight > 760) {
    doc.addPage();
  }

  const startY = doc.y + 14;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;
  const rightX = leftX + pageWidth / 2 + 8;
  const sectionWidth = pageWidth / 2 - 8;

  doc.roundedRect(leftX, startY, pageWidth, blockHeight, 18).fillAndStroke("#f8fbff", "#dbeafe");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("FIRMA DOCUMENTAL", leftX + 16, startY + 16);
  doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(
    "Cierre visual del presupuesto con responsable tecnico y espacios de firma para su salida final.",
    leftX + 16,
    startY + 32,
    { width: pageWidth - 32 },
  );

  if (identityAssets?.companyLogo) {
    doc.image(identityAssets.companyLogo.buffer, leftX + pageWidth - 74, startY + 12, {
      fit: [44, 44],
      align: "center",
      valign: "center",
    });
  }

  drawSignatureSummaryColumn(doc, leftX + 16, startY + 62, sectionWidth - 24, "RESUMEN DOCUMENTAL", summary.document);
  drawSignatureSummaryColumn(doc, rightX + 8, startY + 62, sectionWidth - 24, "RESPONSABLE TECNICO", summary.responsible);

  drawSignatureLineBox(
    doc,
    leftX + 16,
    startY + 168,
    sectionWidth - 24,
    "FIRMA DEL RESPONSABLE",
    summary.responsibleSigner,
    summary.responsibleRole,
    identityAssets?.avatar?.buffer ?? null,
  );
  drawSignatureLineBox(
    doc,
    rightX + 8,
    startY + 168,
    sectionWidth - 24,
    "VO. BO. / APROBACION",
    summary.approverLabel,
    "Espacio reservado para aprobacion del documento",
    null,
  );

  doc.y = startY + blockHeight + 8;
}

function drawSignatureSummaryColumn(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  entries: ReadonlyArray<readonly [string, string]>,
) {
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5).text(title, x, y, { width });

  let currentY = y + 16;

  for (const [label, value] of entries) {
    doc.roundedRect(x, currentY, width, 20, 8).fillAndStroke("#ffffff", "#e2e8f0");
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x + 8, currentY + 6, { width: 82 });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8).text(value, x + 92, currentY + 6, {
      width: width - 100,
      ellipsis: true,
    });
    currentY += 24;
  }
}

function drawSignatureLineBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  primary: string,
  secondary: string,
  imageBuffer: Buffer | null,
) {
  doc.roundedRect(x, y, width, 48, 12).dash(4, { space: 4 }).stroke("#94a3b8");
  doc.undash();
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7.5).text(title, x + 10, y + 8, { width: width - 20 });
  if (imageBuffer) {
    doc.image(imageBuffer, x + 10, y + 20, {
      fit: [24, 24],
      align: "center",
      valign: "center",
    });
  }
  doc.moveTo(x + 10, y + 28).lineTo(x + width - 10, y + 28).stroke("#94a3b8");
  const textX = imageBuffer ? x + 40 : x + 10;
  const textWidth = imageBuffer ? width - 50 : width - 20;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text(primary, textX, y + 32, { width: textWidth, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text(secondary, textX, y + 42, { width: textWidth, align: "center" });
}
