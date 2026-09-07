/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentManager } from "@/components/review-intelligence/document-manager";
import { FindingDetail } from "@/components/review-intelligence/finding-detail";
import { FindingQueue } from "@/components/review-intelligence/finding-queue";
import { ReviewDashboard } from "@/components/review-intelligence/review-dashboard";
import { ReviewIntelligencePage } from "@/components/review-intelligence/review-intelligence-page";
import { RunComparisonPanel } from "@/components/review-intelligence/run-comparison-panel";
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
  it("sends selected XLSX sheet names in the review configuration", async () => {
    const xlsxDocument: ReviewDocumentView = {
      ...documentView,
      id: "document-xlsx",
      name: "Metrados.xlsx",
      originalFileName: "Metrados.xlsx",
      currentVersion: { ...documentView.currentVersion!, id: "version-xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sheetNames: ["Metrados", "Resumen"] },
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("review-documents")) return jsonResponse({ documents: [xlsxDocument] });
      if (url.includes("review-runs?") && init?.method !== "POST") return jsonResponse({ runs: [] });
      if (init?.method === "POST") return jsonResponse({ reviewRunId: "run-xlsx" }, 201);
      return jsonResponse({ runs: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" />);
    await screen.findByText("Metrados.xlsx");
    fireEvent.click(screen.getByLabelText("Incluir Metrados.xlsx en la revisión"));
    fireEvent.click(screen.getByLabelText("Incluir hoja Metrados de Metrados.xlsx"));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => {
      if (init?.method !== "POST" || typeof init.body !== "string") return false;
      const body = JSON.parse(init.body) as { configuration?: { xlsxSheetNames?: string[] } };
      return body.configuration?.xlsxSheetNames?.join(",") === "Metrados";
    })).toBe(true));
    const reviewBody = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body;
    const configuration = JSON.parse(String(reviewBody)).configuration as { findingTypes: string[] };
    expect(configuration.findingTypes).toContain("TECHNICAL_SPEC_MISMATCH");
    expect(configuration.findingTypes).not.toContain("TECHNICAL_SPECIFICATION_MISMATCH");
  });

  it("selects the newly created run instead of keeping findings from the previous run", async () => {
    const newRun: ReviewRunView = { ...runningRun, id: "run-new", status: "QUEUED", progress: { stage: "validating", completed: 0, total: 8, percent: 0 } };
    let created = false;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("review-documents")) return jsonResponse({ documents: [documentView] });
      if (url.includes("review-runs?") && init?.method !== "POST") return jsonResponse({ runs: created ? [newRun, runningRun] : [runningRun] });
      if (init?.method === "POST") { created = true; return jsonResponse({ reviewRunId: "run-new" }, 201); }
      if (url.includes("run-new/findings")) return jsonResponse({ findings: [], page: 1, pageSize: 25, hasNextPage: false });
      if (url.endsWith("/run-1/findings")) return jsonResponse(findingPage);
      return jsonResponse(newRun);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" />);
    await screen.findByText("Planos.pdf");
    fireEvent.click(screen.getByLabelText("Incluir Planos.pdf en la revisión"));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));

    await waitFor(() => expect(screen.getByTestId("review-lifecycle-status").textContent).toBe("En cola"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("run-new/findings"))).toBe(true));
  }, 15000);

  it("shows the empty state with supported formats and human-review guardrails", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ documents: [], page: 1, pageSize: 25, hasNextPage: false }))
      .mockResolvedValueOnce(jsonResponse({ runs: [], page: 1, pageSize: 25, hasNextPage: false }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" budgetName="Presupuesto demo" projectName="Obra demo" />);

    expect(await screen.findByRole("heading", { name: /Revisi.*Inteligente/ })).toBeTruthy();
    expect(screen.getByText(/Aún no hay revisiones/i)).toBeTruthy();
    expect(screen.getByText(/PDF y XLSX/i)).toBeTruthy();
    expect(screen.getByText(/humana/i)).toBeTruthy();
    expect(screen.getByText(/Sin mutaci.*autom.*tica/i)).toBeTruthy();
  });

  it("uses the system confirmation dialog before clearing review history", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ documents: [], runs: [] })));
    render(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Limpiar revisiones" }));
    expect(screen.getByRole("heading", { name: "Limpiar revisiones" })).toBeTruthy();
    expect(screen.getByText(/eliminará todas las revisiones/i)).toBeTruthy();
  });

  it("shows lifecycle status and editor action while keeping the action hidden for a viewer", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ documents: [], runs: [], findings: [], page: 1, pageSize: 25, hasNextPage: false })));
    const completed: ReviewRunView = { ...runningRun, status: "COMPLETED", updatedAt: "2026-09-03T12:00:00.000Z" };
    const { rerender } = render(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" initialRun={completed} canResolve />);
    expect((await screen.findByTestId("review-lifecycle-status")).textContent).toBe("Completada");
    expect(screen.getByRole("button", { name: "Pasar a revisión" })).toBeTruthy();
    rerender(<ReviewIntelligencePage budgetId="budget-1" projectId="project-1" initialRun={completed} canResolve={false} />);
    expect(screen.queryByRole("button", { name: "Pasar a revisión" })).toBeNull();
  });
});

describe("ReviewDashboard", () => {
  it("renders persisted stage progress and warnings with text labels", () => {
    render(<ReviewDashboard run={runningRun} findingCount={3} documentCount={2} />);

    expect(screen.getAllByText("Procesando evidencia").length).toBeGreaterThan(0);
    expect(screen.getByText("3 registrados")).toBeTruthy();
    expect(screen.getByText("1 advertencia de procesamiento")).toBeTruthy();
    expect(screen.getByText(/No se generan cambios automáticos/i)).toBeTruthy();
  });

  it("renders validated coverage categories and partial-source warnings from a persisted run", async () => {
    const persistedRun = {
      id: "run-coverage",
      status: "COMPLETED",
      progressJson: {
        stage: "completed",
        completed: 8,
        total: 8,
        percent: 100,
        metrics: {
          coverageByCategory: { quantity: 12, unit: 9, specification: 7, apuComponent: 4, yield: 3, ignored: "invalid" },
          partiallyCoveredSources: 2,
        },
      },
      warningsJson: [],
      createdAt: "2026-09-06T12:00:00.000Z",
      updatedAt: "2026-09-06T12:05:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("review-documents")) return jsonResponse({ documents: [] });
      if (url.includes("review-runs?") || url.endsWith("/run-coverage")) return jsonResponse({ runs: [persistedRun], ...persistedRun });
      if (url.includes("findings")) return jsonResponse({ findings: [], page: 1, pageSize: 25, hasNextPage: false });
      return jsonResponse({});
    }));

    render(<ReviewIntelligencePage budgetId="budget-coverage" projectId="project-coverage" />);

    const coverage = await screen.findByRole("region", { name: "Cobertura por categoría" });
    expect(coverage.textContent).toContain("Metrados");
    expect(coverage.textContent).toContain("12");
    expect(coverage.textContent).toContain("Unidades");
    expect(coverage.textContent).toContain("9");
    expect(coverage.textContent).toContain("Especificaciones");
    expect(coverage.textContent).toContain("7");
    expect(coverage.textContent).toContain("APU");
    expect(coverage.textContent).toContain("4");
    expect(coverage.textContent).toContain("Rendimientos");
    expect(coverage.textContent).toContain("3");
    expect(screen.getByRole("status", { name: "Advertencia de cobertura parcial" }).textContent).toContain("2 fuentes con cobertura parcial");
  });
});

describe("DocumentManager", () => {
  it("renders persisted classification signals with accessible explanatory copy", () => {
    const suggestedDocument: ReviewDocumentView = { ...documentView, classificationSuggestion: { category: "QUANTITY_TAKEOFF", score: 0.8, signals: ["filename:metrado", "header:metrado"] } };
    render(<DocumentManager projectId="project-1" documents={[suggestedDocument]} onChanged={vi.fn()} />);

    expect(screen.getByLabelText("Señales de clasificación de Planos.pdf").textContent).toContain("filename:metrado · header:metrado");
  });

  it("exposes document status, provenance metadata, warning text, and an accessible upload control", () => {
    render(<DocumentManager projectId="project-1" documents={[documentView]} onChanged={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Documentos fuente" })).toBeTruthy();
    expect(screen.getByText("Planos.pdf")).toBeTruthy();
    expect(screen.getByText("PDF · versión 2 · 8 páginas")).toBeTruthy();
    expect(screen.getByText(/Parcial: página 8 sin texto extraíble/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cargar documento PDF o XLSX" })).toBeTruthy();
    expect(screen.getByLabelText("Categoría del documento" )).toBeTruthy();
  });

  it("keeps document information and actions in a shared row", () => {
    const { container } = render(<DocumentManager projectId="project-1" documents={[documentView]} onChanged={vi.fn()} />);
    const card = container.querySelector('[data-testid="review-document-manager"]');
    const layoutStyles = card?.querySelector("style")?.textContent ?? "";

    expect(layoutStyles).toContain(".flex.flex-col.gap-3.rounded-xl.border");
    expect(layoutStyles).toContain("flex-direction: column");
    expect(layoutStyles).toContain("grid-template-columns: minmax(0, 1fr) auto");
  });

  it("uses the system confirmation dialog before clearing source documents", () => {
    render(<DocumentManager projectId="project-1" documents={[documentView]} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar documentos fuente" }));
    expect(screen.getByRole("heading", { name: "Limpiar documentos fuente" })).toBeTruthy();
    expect(screen.getByText(/documentos fuente.*evidencias.*revisiones/i)).toBeTruthy();
  });

  it("exposes an accessible action for pending page coverage", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ coverage: [], warnings: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const pendingDocument: ReviewDocumentView = { ...documentView, currentVersion: { ...documentView.currentVersion!, extractionCoverage: [{ page: 8, coverage: "OCR_REQUIRED" }] } };
    render(<DocumentManager projectId="project-1" documents={[pendingDocument]} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reprocesar cobertura de Planos.pdf" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/review-documents/document-1/reprocess", expect.objectContaining({ method: "POST", body: JSON.stringify({ pages: [8] }) })));
  });
});

describe("RunComparisonPanel", () => {
  it("loads and renders comparison summary for the selected base run", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ summary: { new: 2, persistent: 3, resolved: 1, changed: 4 } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RunComparisonPanel budgetId="budget-1" selectedRun={runningRun} runs={[runningRun, { ...runningRun, id: "run-0" }]} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Ejecución base para comparar" }));
    fireEvent.click(await screen.findByRole("option", { name: /run-0/ }));
    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));
    await waitFor(() => expect(screen.getByText(/Nuevos: 2/)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("baseRunId=run-0"));
  });
});

describe("FindingQueue", () => {
  it("emits accessible filter changes and opens a selected finding", () => {
    const onFilterChange = vi.fn();
    const onOpenFinding = vi.fn();
    render(<FindingQueue data={findingPage} onFilterChange={onFilterChange} onOpenFinding={onOpenFinding} />);

    expect(screen.getByRole("heading", { name: "Bandeja de hallazgos" })).toBeTruthy();
    expect(screen.getAllByText("Diferencia de metrado").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por tipo" }));
    fireEvent.click(screen.getByRole("option", { name: "Diferencia de metrado" }));
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ findingType: "QUANTITY_MISMATCH" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir hallazgo MAT-001" }));
    expect(onOpenFinding).toHaveBeenCalledWith("finding-1");
  });
});

describe("FindingDetail", () => {
  it("assigns a finding to a project member from the detail panel", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ findingId: "finding-1", assignedToId: "member-1" }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();
    render(<FindingDetail finding={finding} canResolve onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText("ID del responsable"), { target: { value: "member-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar responsable" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/review-findings/finding-1/assignment", expect.objectContaining({ method: "PUT" })));
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows provenance and sends an explicit human decision without budget mutation", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: "decision-1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(<FindingDetail finding={finding} canResolve onChanged={onChanged} />);

    expect(screen.getByRole("region", { name: "Visor estructurado de provenance" })).toBeTruthy();
    expect(screen.getByRole("spinbutton")).toBeTruthy();
    expect(screen.getByTestId("evidence-highlight")).toBeTruthy();
    expect(screen.getByText(/12/)).toBeTruthy();
    expect(screen.getAllByText(/requerida/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/presupuesto no se modifica/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /V.*lido sin cambios/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/review-findings/finding-1/decisions",
      expect.objectContaining({ method: "POST" }),
    ));
    const request = fetchMock.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain("VALID_AS_IS");
    expect(String(request?.body)).not.toContain("BudgetItem");
    expect(onChanged).toHaveBeenCalled();
  });

  it("keeps provenance readable but hides resolution actions for a viewer", () => {
    render(<FindingDetail finding={finding} canResolve={false} onChanged={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Visor estructurado de provenance" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /V.*lido sin cambios/ })).toBeNull();
  });
  it("renders comparison details for yield, specification, and missing APU components", () => {
    const { rerender } = render(<FindingDetail finding={{ ...finding, findingType: "YIELD_MISMATCH", comparison: { documentValue: "8.000", budgetValue: "4.000", difference: "4.000", unit: "m3" } }} canResolve={false} onChanged={vi.fn()} />);
    expect(screen.getByText("Rendimiento documentado")).toBeTruthy();
    expect(screen.getByText("8.000")).toBeTruthy();
    expect(screen.getByText("Rendimiento presupuestado")).toBeTruthy();

    rerender(<FindingDetail finding={{ ...finding, findingType: "TECHNICAL_SPEC_MISMATCH", comparison: { details: { documentSpecification: "Concreto f'c 210", budgetSpecification: "Concreto f'c 280" } } }} canResolve={false} onChanged={vi.fn()} />);
    expect(screen.getByText("Especificación documentada")).toBeTruthy();
    expect(screen.getByText("Concreto f'c 210")).toBeTruthy();
    expect(screen.getByText("Especificación del presupuesto")).toBeTruthy();

    rerender(<FindingDetail finding={{ ...finding, findingType: "INCOMPLETE_APU", comparison: { details: { missingComponents: "arena, aditivo" } } }} canResolve={false} onChanged={vi.fn()} />);
    expect(screen.getByText("Componentes APU faltantes")).toBeTruthy();
    expect(screen.getByText("arena, aditivo")).toBeTruthy();
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
  metrics: { analyzedItems: 12, totalItems: 15, coveragePercent: 80, evidenceCount: 2, linkedEvidenceCount: 2, findingsByStatus: { PENDING: 3 }, findingsByType: { QUANTITY_MISMATCH: 3 }, failures: 0, incompleteness: 1, deltaVsPrevious: 1 },
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
