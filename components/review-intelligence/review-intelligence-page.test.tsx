/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentManager } from "@/components/review-intelligence/document-manager";
import { FindingDetail } from "@/components/review-intelligence/finding-detail";
import { FindingQueue } from "@/components/review-intelligence/finding-queue";
import { ReviewDashboard } from "@/components/review-intelligence/review-dashboard";
import { ReviewIntelligencePage } from "@/components/review-intelligence/review-intelligence-page";
import type {
  FindingView,
  PaginatedFindings,
  ReviewDocumentView,
  ReviewRunView,
} from "@/components/review-intelligence/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReviewIntelligencePage", () => {
  it("shows the empty state with supported formats and human-review guardrails", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ documents: [], page: 1, pageSize: 25, hasNextPage: false }))
      .mockResolvedValueOnce(jsonResponse({ runs: [], page: 1, pageSize: 25, hasNextPage: false }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" budgetName="Presupuesto demo" projectName="Obra demo" />);

    expect(await screen.findByRole("heading", { name: "Revisión Inteligente" })).toBeTruthy();
    expect(screen.getByText(/Aún no hay revisiones/i)).toBeTruthy();
    expect(screen.getByText(/PDF y XLSX/i)).toBeTruthy();
    expect(screen.getByText(/revisión humana/i)).toBeTruthy();
    expect(screen.getByText(/Sin mutación automática/i)).toBeTruthy();
  });
});

describe("ReviewDashboard", () => {
  it("renders persisted stage progress and warnings with text labels", () => {
    render(<ReviewDashboard run={runningRun} findingCount={3} documentCount={2} />);

    expect(screen.getAllByText("Procesando evidencia").length).toBeGreaterThan(0);
    expect(screen.getByText("3 para revisar")).toBeTruthy();
    expect(screen.getByText("1 advertencia de procesamiento")).toBeTruthy();
    expect(screen.getByText(/No se generan cambios automáticos/i)).toBeTruthy();
  });
});

describe("DocumentManager", () => {
  it("exposes document status, provenance metadata, warning text, and an accessible upload control", () => {
    render(<DocumentManager projectId="project-1" documents={[documentView]} onChanged={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Documentos fuente" })).toBeTruthy();
    expect(screen.getByText("Planos.pdf")).toBeTruthy();
    expect(screen.getByText("PDF · versión 2 · 8 páginas")).toBeTruthy();
    expect(screen.getByText(/Parcial: página 8 sin texto extraíble/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cargar documento PDF o XLSX" })).toBeTruthy();
    expect(screen.getByLabelText("Categoría del documento" )).toBeTruthy();
  });
});

describe("FindingQueue", () => {
  it("emits accessible filter changes and opens a selected finding", () => {
    const onFilterChange = vi.fn();
    const onOpenFinding = vi.fn();
    render(<FindingQueue data={findingPage} onFilterChange={onFilterChange} onOpenFinding={onOpenFinding} />);

    expect(screen.getByRole("heading", { name: "Bandeja de hallazgos" })).toBeTruthy();
    expect(screen.getAllByText("Diferencia de metrado").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Filtrar por tipo"), { target: { value: "QUANTITY_MISMATCH" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ findingType: "QUANTITY_MISMATCH" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir hallazgo MAT-001" }));
    expect(onOpenFinding).toHaveBeenCalledWith("finding-1");
  });
});

describe("FindingDetail", () => {
  it("shows provenance and sends an explicit human decision without budget mutation", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: "decision-1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(<FindingDetail finding={finding} canResolve onChanged={onChanged} />);

    expect(screen.getByRole("region", { name: "Visor estructurado de provenance" })).toBeTruthy();
    expect(screen.getByLabelText("Página de evidencia")).toBeTruthy();
    expect(screen.getByTestId("evidence-highlight")).toBeTruthy();
    expect(screen.getByText(/12/)).toBeTruthy();
    expect(screen.getAllByText(/Revisión humana requerida/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/El presupuesto no se modifica automáticamente/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "VALID_AS_IS" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/review-findings/finding-1/decisions",
      expect.objectContaining({ method: "POST" }),
    ));
    const request = fetchMock.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain("VALID_AS_IS");
    expect(String(request?.body)).not.toContain("BudgetItem");
    expect(onChanged).toHaveBeenCalled();
  });
});

const runningRun: ReviewRunView = {
  id: "run-1",
  budgetId: "budget-1",
  status: "RUNNING",
  progress: { stage: "evidence", completed: 4, total: 8, percent: 50 },
  warnings: [{ code: "PDF_PARTIAL", message: "Página 8 sin texto extraíble." }],
  createdAt: "2026-09-02T12:00:00.000Z",
  updatedAt: "2026-09-02T12:05:00.000Z",
};

const documentView: ReviewDocumentView = {
  id: "document-1",
  name: "Planos.pdf",
  originalFileName: "Planos.pdf",
  category: "PLAN",
  status: "COMPLETED_WITH_WARNINGS",
  currentVersion: {
    id: "version-2",
    versionNumber: 2,
    mimeType: "application/pdf",
    fileSizeBytes: 240_000,
    pageCount: 8,
    sheetCount: null,
    extractionStatus: "COMPLETED_WITH_WARNINGS",
  },
  warnings: ["Parcial: página 8 sin texto extraíble."],
};

const finding: FindingView = {
  id: "finding-1",
  findingType: "QUANTITY_MISMATCH",
  status: "PENDING",
  severity: "HIGH",
  priority: "0.83",
  confidence: "HIGH",
  potentialImpact: "1250.50",
  updatedAt: "2026-09-02T12:05:00.000Z",
  humanReviewRequired: true,
  automaticBudgetMutation: false,
  budgetItem: { id: "item-1", code: "MAT-001", description: "Concreto estructural", unit: "m3", quantity: "12.00", unitPrice: "100.00", discipline: "Estructuras" },
  comparison: { message: "El metrado documentado difiere del presupuesto.", documentValue: "24.50", budgetValue: "12.00", difference: "12.50", potentialImpact: "1250.50", unit: "m3" },
  evidence: { id: "evidence-1", evidenceType: "QUANTITY", originalText: "24.50 m3", location: { page: 12, row: 4 }, confidence: "HIGH", extractionMethod: "PDF_TEXT", viewUrl: "/api/review-evidence/evidence-1/view?token=temporary" },
  entityLink: { id: "link-1", score: "0.94", confidence: "HIGH", validationStatus: "PENDING" },
  decisionHistory: [],
};

const findingPage: PaginatedFindings = { findings: [finding], page: 1, pageSize: 25, hasNextPage: false };

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
