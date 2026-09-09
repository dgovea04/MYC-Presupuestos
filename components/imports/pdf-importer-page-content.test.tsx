/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfImporterPageContent } from "./pdf-importer-page-content";

describe("PdfImporterPageContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the PDF import workflow controls", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} />);

    expect(screen.getByText("PDFs del proyecto")).toBeTruthy();
    expect(screen.getByText("Constructora Demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Generar draft/i })).toHaveProperty("disabled", true);
  });

  it("presents the multi-file upload area with a shared document type selector", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} />);

    expect(screen.getByRole("combobox", { name: "Tipo de archivo PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subir archivos PDF" })).toBeTruthy();
    expect(screen.getByText("Arrastra y suelta archivos aquí o usa el botón superior")).toBeTruthy();
    expect(screen.getByText(/PDF de presupuesto, precios unitarios/)).toBeTruthy();
  });

  it("keeps multiple selected PDFs and applies the selected type", () => {
    const { container } = render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} />);
    const roleSelect = screen.getByRole("combobox", { name: "Tipo de archivo PDF" });
    fireEvent.change(roleSelect, { target: { value: "APU" } });

    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["budget"], "presupuesto.pdf", { type: "application/pdf" }),
          new File(["apu"], "precios-unitarios.pdf", { type: "application/pdf" }),
        ],
      },
    });

    expect(screen.getByText("presupuesto.pdf")).toBeTruthy();
    expect(screen.getByText("precios-unitarios.pdf")).toBeTruthy();
    expect(screen.getAllByRole("combobox", { name: /Tipo de presupuesto.pdf|Tipo de precios-unitarios.pdf/ })).toHaveLength(2);
    expect(screen.getAllByRole("combobox", { name: /Tipo de presupuesto.pdf|Tipo de precios-unitarios.pdf/ }).every((select) => (select as HTMLSelectElement).value === "APU")).toBe(true);
  });

  it("shows the sanitized AI debugger when OCR fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "No se pudo preparar el draft de importacion PDF. Gemini OCR respondio con estado 503.",
      aiDebug: [{
        stage: "ocr",
        provider: "gemini",
        model: "gemini-2.5-flash-lite",
        pageNumber: 1,
        fileName: "scan.pdf",
        request: { method: "POST", url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent", body: { pdf: { base64: "<redacted>" } } },
        response: { status: 503, statusText: "Service Unavailable", headers: {}, body: { error: { message: "backend unavailable" } } },
        error: "HTTP 503",
      }],
    }), { status: 500, headers: { "Content-Type": "application/json" } }));

    const { container } = render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} />);
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [new File(["scan"], "scan.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Generar draft/i }));

    await waitFor(() => expect(screen.getByText("Diagnóstico IA del importador PDF")).toBeTruthy());
    expect(screen.getByText(/Gemini.*pagina 1.*HTTP 503/i)).toBeTruthy();
    expect(screen.getByText(/<redacted>/i)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("renders detected subpartidas in the draft preview", () => {
    render(
      <PdfImporterPageContent
        companies={[{ id: "company-1", name: "Constructora Demo" }]}
        initialDraft={{
          source: "PDF_AI",
          project: { name: "Proyecto", currency: "PEN" },
          sourceFiles: [{ id: "file-1", fileName: "pdf.pdf", role: "AUTO", pageCount: 1, confidence: 0.8 }],
          budgets: [],
          apus: [],
          subpartidas: [
            {
              id: "sub-1",
              code: "SP-01",
              description: "Preparacion de concreto fc 210",
              unit: "m3",
              unitPrice: "120",
              performance: "1",
              rows: [],
              evidence: { sourceFileName: "pdf.pdf", sourcePage: 1, rawText: "SP-01", confidence: 0.8 },
            },
          ],
          resources: [],
          links: [],
          validations: [],
          warnings: [],
        }}
      />,
    );

    expect(screen.getByText(/1 subpartidas/)).toBeTruthy();
    expect(screen.getByText("Preparacion de concreto fc 210")).toBeTruthy();
  });

  it("renders every detected budget item instead of truncating the preview", () => {
    const items = Array.from({ length: 13 }, (_, index) => ({
      id: `item-${index + 1}`,
      code: `01.${String(index + 1).padStart(2, "0")}`,
      description: `Partida ${index + 1}`,
      unit: "m2",
      quantity: "1",
      unitPrice: "10",
      partial: "10",
      sortOrder: index + 1,
      evidence: { sourceFileName: "presupuesto.pdf", sourcePage: 1, rawText: "", confidence: 0.9 },
    }));

    render(
      <PdfImporterPageContent
        companies={[{ id: "company-1", name: "Constructora Demo" }]}
        initialDraft={{
          source: "PDF_AI",
          project: { name: "Proyecto", currency: "PEN" },
          sourceFiles: [{ id: "file-1", fileName: "presupuesto.pdf", role: "BUDGET", pageCount: 1, confidence: 0.9 }],
          budgets: [{ id: "budget-1", name: "Presupuesto", kind: "GENERAL", currency: "PEN", levels: [], items }],
          apus: [],
          subpartidas: [],
          resources: [],
          links: [],
          validations: [],
          warnings: [],
        }}
      />,
    );

    expect(screen.getByLabelText("Descripcion 01.13")).toBeTruthy();
  });

  it("renders recognized budget titles and subtitles", () => {
    render(
      <PdfImporterPageContent
        companies={[{ id: "company-1", name: "Constructora Demo" }]}
        initialDraft={{
          source: "PDF_AI",
          project: { name: "Proyecto", currency: "PEN" },
          sourceFiles: [{ id: "file-1", fileName: "presupuesto.pdf", role: "BUDGET", pageCount: 1, confidence: 0.9 }],
          budgets: [{
            id: "budget-1",
            name: "Presupuesto",
            kind: "GENERAL",
            currency: "PEN",
            levels: [
              { id: "level-8", code: "8", name: "PROTECCION AMBIENTAL", type: "TITLE", parentId: null, sortOrder: 1 },
              { id: "level-8-1", code: "8.1", name: "PROGRAMA DE CIERRE DE OBRA", type: "SUBTITLE", parentId: "level-8", sortOrder: 2 },
            ],
            items: [{
              id: "item-8-1-1",
              code: "8.1.1",
              description: "RETIRO Y ALMACENAMIENTO DE TOP SOIL",
              unit: "M2",
              quantity: "10",
              unitPrice: "20",
              partial: "200",
              sortOrder: 1,
              levelId: "level-8-1",
              evidence: { sourceFileName: "presupuesto.pdf", sourcePage: 1, rawText: "", confidence: 0.9 },
            }],
            footerRows: [{ id: "footer-total", variable: "TOTAL", description: "TOTAL PRESUPUESTO", rate: null, value: "200", highlight: true, sortOrder: 1 }],
          }],
          apus: [],
          subpartidas: [],
          resources: [],
          links: [],
          validations: [],
          warnings: [],
        }}
      />,
    );

    expect(screen.getAllByText("PROTECCION AMBIENTAL")).toHaveLength(2);
    expect(screen.getAllByText("PROGRAMA DE CIERRE DE OBRA")).toHaveLength(2);
    expect(screen.getByText("Resumen / pie de presupuesto")).toBeTruthy();
    expect(screen.getByText("TOTAL PRESUPUESTO")).toBeTruthy();
  });

  it("renders review groups for PDF import conflicts", () => {
    render(
      <PdfImporterPageContent
        companies={[{ id: "company-1", name: "Constructora Demo" }]}
        initialDraft={{
          source: "PDF_AI",
          project: { name: "Proyecto con conflictos", currency: "PEN" },
          sourceFiles: [{ id: "file-1", fileName: "scan.pdf", role: "AUTO", pageCount: 2, confidence: 0.42 }],
          budgets: [
            {
              id: "budget-1",
              name: "General",
              kind: "GENERAL",
              currency: "PEN",
              levels: [],
              items: [
                {
                  id: "item-1",
                  code: "01.01",
                  description: "Partida sin APU",
                  unit: "m2",
                  quantity: "10",
                  unitPrice: "20",
                  partial: "200",
                  sortOrder: 1,
                  evidence: { sourceFileName: "scan.pdf", sourcePage: 1, rawText: "01.01", confidence: 0.41 },
                },
                {
                  id: "item-2",
                  code: "01.02",
                  description: "Partida con diferencia",
                  unit: "m3",
                  quantity: "1",
                  unitPrice: "100",
                  partial: "100",
                  sortOrder: 2,
                  evidence: { sourceFileName: "scan.pdf", sourcePage: 1, rawText: "01.02", confidence: 0.8 },
                },
              ],
            },
          ],
          apus: [
            {
              id: "apu-1",
              budgetItemCode: "01.02",
              name: "Partida con diferencia",
              unit: "m3",
              performance: "1",
              totalUnitCost: "120",
              rows: [
                {
                  id: "row-1",
                  description: "Subpartida ambigua",
                  unit: "m3",
                  resourceType: "SUBPARTIDA",
                  quantity: "1",
                  unitPrice: "30",
                  subtotal: "30",
                  sortOrder: 1,
                  evidence: { sourceFileName: "scan.pdf", sourcePage: 2, rawText: "sub", confidence: 0.4 },
                },
              ],
              evidence: { sourceFileName: "scan.pdf", sourcePage: 2, rawText: "apu", confidence: 0.88 },
            },
            {
              id: "apu-2",
              budgetItemCode: "09.09",
              name: "APU sin partida",
              unit: "und",
              performance: "1",
              totalUnitCost: "15",
              rows: [],
              evidence: { sourceFileName: "scan.pdf", sourcePage: 2, rawText: "apu suelto", confidence: 0.9 },
            },
          ],
          subpartidas: [],
          resources: [
            {
              id: "resource-1",
              code: "",
              description: "Cemento nuevo",
              category: "MATERIAL",
              unit: "bol",
              unitPrice: "35",
              currency: "PEN",
              evidence: { sourceFileName: "scan.pdf", sourcePage: 2, rawText: "cemento", confidence: 0.75 },
            },
          ],
          links: [
            {
              id: "link-missing",
              fromId: "item-1",
              kind: "BUDGET_ITEM_APU",
              status: "MISSING_APU",
              confidence: 0,
              reason: "No se encontro un APU compatible.",
            },
            {
              id: "link-price",
              fromId: "item-2",
              toId: "apu-1",
              kind: "BUDGET_ITEM_APU",
              status: "PRICE_MISMATCH",
              confidence: 0.7,
              reason: "Diferencia de precio.",
            },
            {
              id: "link-orphan",
              fromId: "apu-2",
              kind: "BUDGET_ITEM_APU",
              status: "MISSING_BUDGET_ITEM",
              confidence: 0,
              reason: "No se encontro partida compatible.",
            },
            {
              id: "link-sub",
              fromId: "row-1",
              kind: "APU_SUBPARTIDA",
              status: "NEEDS_REVIEW",
              confidence: 0.3,
              reason: "Subpartida ambigua.",
            },
          ],
          validations: [],
          warnings: ["scan.pdf fue procesado con OCR/vision; revisa las filas de baja confianza."],
        }}
      />,
    );

    expect(screen.getByText("Revision requerida")).toBeTruthy();
    expect(screen.getByText("Partidas sin APU")).toBeTruthy();
    expect(screen.getByText("01.01 · Partida sin APU")).toBeTruthy();
    expect(screen.getByDisplayValue("Partida sin APU")).toBeTruthy();
    expect(screen.getByText("Sin APU")).toBeTruthy();
    expect(screen.getByText("Diferencia: 20.00")).toBeTruthy();
    expect(screen.getByText("APU sin partida")).toBeTruthy();
    expect(screen.getByText("Diferencia de precio.")).toBeTruthy();
    expect(screen.getByText("01.02 · Partida con diferencia")).toBeTruthy();
    expect(screen.getByText("Subpartida ambigua")).toBeTruthy();
    expect(screen.getByText("Cemento nuevo")).toBeTruthy();
    expect(screen.getAllByText("scan.pdf p. 1").length).toBeGreaterThan(0);
  });

  it("allows editing budget item fields in the draft preview", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={createEditableDraft()} />);

    fireEvent.change(screen.getByLabelText("Descripcion 01.01"), { target: { value: "Trazo corregido" } });
    fireEvent.change(screen.getByLabelText("Cantidad 01.01"), { target: { value: "12" } });

    expect(screen.getByDisplayValue("Trazo corregido")).toBeTruthy();
    expect(screen.getByDisplayValue("12")).toBeTruthy();
  });

  it("paginates review groups while keeping six issues visible", () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      id: `missing-item-${index + 1}`,
      code: `01.0${index + 1}`,
      description: `Partida sin APU ${index + 1}`,
      unit: "m2",
      quantity: "1",
      unitPrice: "10",
      partial: "10",
      sortOrder: index + 1,
      evidence: { sourceFileName: "presupuesto.pdf", sourcePage: 1, rawText: "", confidence: 0.9 },
    }));
    const links = items.map((item, index) => ({
      id: `missing-link-${index + 1}`,
      fromId: item.id,
      kind: "BUDGET_ITEM_APU" as const,
      status: "MISSING_APU" as const,
      confidence: 0,
      reason: "No se encontro un APU compatible.",
    }));

    render(
      <PdfImporterPageContent
        companies={[{ id: "company-1", name: "Constructora Demo" }]}
        initialDraft={{
          source: "PDF_AI",
          project: { name: "Proyecto", currency: "PEN" },
          sourceFiles: [{ id: "file-1", fileName: "presupuesto.pdf", role: "BUDGET", pageCount: 1, confidence: 0.9 }],
          budgets: [{ id: "budget-1", name: "Presupuesto", kind: "GENERAL", currency: "PEN", levels: [], items }],
          apus: [], subpartidas: [], resources: [], links, validations: [], warnings: [],
        }}
      />,
    );

    expect(screen.getByText("Pagina 1 de 2")).toBeTruthy();
    expect(screen.getByText("01.01 · Partida sin APU 1")).toBeTruthy();
    expect(screen.getByText("01.06 · Partida sin APU 6")).toBeTruthy();
    expect(screen.queryByText("01.07 · Partida sin APU 7")).toBeNull();

    fireEvent.click(screen.getByText("Siguiente"));

    expect(screen.getByText("Pagina 2 de 2")).toBeTruthy();
    expect(screen.getByText("01.07 · Partida sin APU 7")).toBeTruthy();
  });

  it("allows approving a linked price difference for import review", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={createEditableDraft()} />);

    expect(screen.getByText("1 errores criticos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar diferencia" }));

    expect(screen.getByText("0 errores criticos")).toBeTruthy();
  });

  it("allows approving an assumed performance of one", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={{
      source: "PDF_AI",
      project: { name: "Proyecto", currency: "PEN" },
      sourceFiles: [{ id: "file-1", fileName: "apus.pdf", role: "APU", pageCount: 1, confidence: 0.9 }],
      budgets: [],
      apus: [{
        id: "apu-2-4", budgetItemCode: "2.4", name: "EXCAVACION EN EXPLANACIONES EN ROCA FIJA", unit: "M3",
        performance: "1", performanceMissing: true, totalUnitCost: "27.62", rows: [],
        evidence: { sourceFileName: "apus.pdf", sourcePage: 1, rawText: "Rendimiento: M3/DIA", confidence: 0.9 },
      }],
      subpartidas: [], resources: [], links: [],
      validations: [{ id: "validation-apu-2-4-performance", severity: "error", code: "MISSING_PERFORMANCE", message: "La partida 2.4 no informa rendimiento; se asumió 1.", entityId: "apu-2-4" }],
      warnings: ["La partida 2.4 no informa rendimiento; se asumiÃ³ 1."],
    }} />);

    expect(screen.getByText("APUs sin rendimiento")).toBeTruthy();
    expect(screen.getAllByText("La partida 2.4 no informa rendimiento; se asumiÃ³ 1.")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Aprobar rendimiento 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar rendimiento 1" }));
    expect(screen.queryByText("APUs sin rendimiento")).toBeNull();
    expect(screen.getByText("Rendimiento 1 aprobado para apu-2-4.")).toBeTruthy();
  });

  it("allows linking a missing budget item APU from review", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={createLinkResolutionDraft()} />);

    fireEvent.change(screen.getByLabelText("Seleccionar APU para Partida sin APU"), { target: { value: "apu-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular APU" }));

    expect(screen.queryByText("Partidas sin APU")).toBeNull();
    expect(screen.getByText("APU vinculado para item-1.")).toBeTruthy();
  });

  it("allows linking an orphan APU to a budget item from review", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={createLinkResolutionDraft()} />);

    fireEvent.change(screen.getByLabelText("Seleccionar partida para APU sin partida"), { target: { value: "item-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular partida" }));

    expect(screen.queryByText("APUs sin partida")).toBeNull();
    expect(screen.getByText("Partida vinculada para apu-2.")).toBeTruthy();
  });

  it("allows resolving an ambiguous subpartida from review", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={createLinkResolutionDraft()} />);

    fireEvent.change(screen.getByLabelText("Seleccionar subpartida para Subpartida ambigua"), { target: { value: "sub-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular subpartida" }));

    expect(screen.queryByText("Subpartidas ambiguas")).toBeNull();
    expect(screen.getByText("Subpartida vinculada para row-1.")).toBeTruthy();
  });
});

function createEditableDraft() {
  return {
    source: "PDF_AI" as const,
    project: { name: "Proyecto editable", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "pdf.pdf", role: "AUTO" as const, pageCount: 1, confidence: 0.8 }],
    budgets: [
      {
        id: "budget-1",
        name: "General",
        kind: "GENERAL" as const,
        currency: "PEN",
        levels: [],
        items: [
          {
            id: "item-1",
            code: "01.01",
            description: "Trazo",
            unit: "m2",
            quantity: "10",
            unitPrice: "20",
            partial: "200",
            sortOrder: 1,
            evidence: { sourceFileName: "pdf.pdf", sourcePage: 1, rawText: "01.01", confidence: 0.8 },
          },
        ],
      },
    ],
    apus: [
      {
        id: "apu-1",
        budgetItemCode: "01.01",
        name: "Trazo",
        unit: "m2",
        performance: "1",
        totalUnitCost: "25",
        rows: [],
        evidence: { sourceFileName: "pdf.pdf", sourcePage: 1, rawText: "APU", confidence: 0.8 },
      },
    ],
    subpartidas: [],
    resources: [],
    links: [
      {
        id: "link-price",
        fromId: "item-1",
        toId: "apu-1",
        kind: "BUDGET_ITEM_APU" as const,
        status: "PRICE_MISMATCH" as const,
        confidence: 0.75,
        reason: "Diferencia de precio.",
      },
    ],
    validations: [
      {
        id: "validation-price",
        severity: "error" as const,
        code: "PRICE_MISMATCH",
        message: "Diferencia de precio.",
        entityId: "item-1",
      },
    ],
    warnings: [],
  };
}

function createLinkResolutionDraft() {
  const evidence = { sourceFileName: "pdf.pdf", sourcePage: 1, rawText: "linea", confidence: 0.8 };
  return {
    source: "PDF_AI" as const,
    project: { name: "Proyecto vinculos", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "pdf.pdf", role: "AUTO" as const, pageCount: 1, confidence: 0.8 }],
    budgets: [
      {
        id: "budget-1",
        name: "General",
        kind: "GENERAL" as const,
        currency: "PEN",
        levels: [],
        items: [
          {
            id: "item-1",
            code: "01.01",
            description: "Partida sin APU",
            unit: "m2",
            quantity: "10",
            unitPrice: "20",
            partial: "200",
            sortOrder: 1,
            evidence,
          },
        ],
      },
    ],
    apus: [
      {
        id: "apu-2",
        budgetItemCode: "99.99",
        name: "APU sin partida",
        unit: "m2",
        performance: "1",
        totalUnitCost: "20",
        rows: [
          {
            id: "row-1",
            description: "Subpartida ambigua",
            unit: "m2",
            resourceType: "SUBPARTIDA",
            quantity: "1",
            unitPrice: "5",
            subtotal: "5",
            sortOrder: 1,
            evidence,
          },
        ],
        evidence,
      },
    ],
    subpartidas: [
      {
        id: "sub-1",
        code: "SP-01",
        description: "Subpartida seleccionable",
        unit: "m2",
        unitPrice: "5",
        performance: "1",
        rows: [],
        evidence,
      },
    ],
    resources: [],
    links: [
      {
        id: "link-missing",
        fromId: "item-1",
        kind: "BUDGET_ITEM_APU" as const,
        status: "MISSING_APU" as const,
        confidence: 0,
        reason: "No se encontro un APU compatible.",
      },
      {
        id: "link-orphan",
        fromId: "apu-2",
        kind: "BUDGET_ITEM_APU" as const,
        status: "MISSING_BUDGET_ITEM" as const,
        confidence: 0,
        reason: "No se encontro partida compatible.",
      },
      {
        id: "link-sub",
        fromId: "row-1",
        kind: "APU_SUBPARTIDA" as const,
        status: "NEEDS_REVIEW" as const,
        confidence: 0.3,
        reason: "Subpartida ambigua.",
      },
    ],
    validations: [],
    warnings: [],
  };
}
