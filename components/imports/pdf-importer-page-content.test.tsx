/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
    expect(screen.getByDisplayValue("Partida sin APU")).toBeTruthy();
    expect(screen.getByText("APU sin partida")).toBeTruthy();
    expect(screen.getByText("Diferencia de precio.")).toBeTruthy();
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

  it("allows approving a linked price difference for import review", () => {
    render(<PdfImporterPageContent companies={[{ id: "company-1", name: "Constructora Demo" }]} initialDraft={createEditableDraft()} />);

    expect(screen.getByText("1 errores criticos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar diferencia" }));

    expect(screen.getByText("0 errores criticos")).toBeTruthy();
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
