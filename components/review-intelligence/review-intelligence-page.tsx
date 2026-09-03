"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Play, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { DocumentManager } from "./document-manager";
import { FindingDetail } from "./finding-detail";
import { FindingQueue } from "./finding-queue";
import { ReviewDashboard } from "./review-dashboard";
import type { FindingFilterState, FindingView, PaginatedFindings, ReviewDocumentView, ReviewRunView, ReviewStage, ReviewWarningView } from "./types";

export interface ReviewIntelligencePageProps { budgetId: string; projectId: string; initialRun?: ReviewRunView; budgetName?: string; projectName?: string }

export function ReviewIntelligencePage({ budgetId, projectId, initialRun, budgetName, projectName }: ReviewIntelligencePageProps) {
  const [documents, setDocuments] = useState<ReviewDocumentView[]>([]);
  const [runs, setRuns] = useState<ReviewRunView[]>(initialRun ? [initialRun] : []);
  const [selectedRun, setSelectedRun] = useState<ReviewRunView | undefined>(initialRun);
  const [findings, setFindings] = useState<PaginatedFindings>({ findings: [], page: 1, pageSize: 25, hasNextPage: false });
  const [selectedFinding, setSelectedFinding] = useState<FindingView | undefined>();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<FindingFilterState>({ page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    const payload = await fetchJson<{ documents?: unknown[] }>(`/api/projects/${encodeURIComponent(projectId)}/review-documents?page=1&pageSize=100`);
    setDocuments(payload.documents?.flatMap(parseDocument) ?? []);
  }

  async function loadRuns() {
    const payload = await fetchJson<{ runs?: unknown[] }>(`/api/budgets/${encodeURIComponent(budgetId)}/review-runs?page=1&pageSize=25`);
    const next = payload.runs?.flatMap((value) => { const run = parseRun(value, budgetId); return run ? [run] : []; }) ?? [];
    setRuns(next);
    setSelectedRun((current) => current ? next.find((run) => run.id === current.id) ?? current : next[0]);
  }

  async function loadFindings(run: ReviewRunView, nextFilters = filters) {
    const params = new URLSearchParams({ page: String(nextFilters.page), pageSize: String(nextFilters.pageSize) });
    if (nextFilters.findingType) params.set("findingType", nextFilters.findingType);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.confidence) params.set("confidence", nextFilters.confidence);
    if (nextFilters.document) params.set("document", nextFilters.document);
    const payload = await fetchJson<PaginatedFindings>(`/api/review-runs/${encodeURIComponent(run.id)}/findings?${params.toString()}`);
    setFindings(parseFindingPage(payload));
  }

  async function loadProgress(run: ReviewRunView) {
    const progress = parseProgress(await fetchJson<unknown>(`/api/review-runs/${encodeURIComponent(run.id)}`), run);
    setSelectedRun(progress);
    setRuns((current) => current.map((item) => item.id === progress.id ? progress : item));
  }

  useEffect(() => {
    let active = true;
    // The effect synchronizes this client view with the protected review APIs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadDocuments(), loadRuns()])
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la revisión."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Loader functions intentionally stay local to keep the API orchestration private to this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId, projectId]);

  useEffect(() => {
    if (!selectedRun) return;
    // The effect synchronizes persisted findings/progress after a run or filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFindings(selectedRun).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los hallazgos."));
    void loadProgress(selectedRun).catch(() => undefined);
    // The selected run object is refreshed by the effect itself; the stable trigger is its id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun?.id, filters]);

  const selectedVersionIds = useMemo(() => selectedDocumentIds.flatMap((id) => {
    const version = documents.find((document) => document.id === id)?.currentVersion;
    return version ? [version.id] : [];
  }), [documents, selectedDocumentIds]);

  async function startReview() {
    if (selectedVersionIds.length === 0) { setError("Selecciona al menos un documento con versión disponible."); return; }
    setStarting(true); setError(null);
    try {
      const response = await fetch(`/api/budgets/${encodeURIComponent(budgetId)}/review-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `review-ui-${Date.now()}` },
        body: JSON.stringify({ documentVersionIds: selectedVersionIds, configuration: { maxFiles: 10, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1.00", findingTypes: ["QUANTITY_MISMATCH", "UNIT_INCONSISTENCY", "TECHNICAL_SPEC_MISMATCH", "MISSING_DOCUMENTATION", "INCOMPLETE_APU"] }, rulesVersion: "review-rules-v1" }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "No se pudo iniciar la revisión.");
      await loadRuns();
    } catch (startError) { setError(startError instanceof Error ? startError.message : "No se pudo iniciar la revisión."); }
    finally { setStarting(false); }
  }

  return (
    <div className="space-y-5" data-testid="review-intelligence-page">
      <Card className="theme-surface-card"><CardHeader className="theme-surface-card-gradient"><PageHeaderCard icon={<ClipboardCheck className="h-5 w-5" />} title="Revisión Inteligente" description={`Compara ${budgetName ?? "este presupuesto"} con evidencia de ${projectName ?? "tu proyecto"}, con trazabilidad y revisión humana.`} badges={<><span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium">Presupuesto</span><span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium">Sin mutación automática</span></>} actions={<div className="flex flex-wrap gap-2"><Link href={`/budgets/${encodeURIComponent(budgetId)}`}><ActionButton action="open" label="Volver al presupuesto" variant="outline" /></Link><Button type="button" onClick={() => void startReview()} loading={starting} disabled={selectedVersionIds.length === 0}><Play className="h-4 w-4" aria-hidden="true" />Iniciar revisión</Button></div>} /></CardHeader><CardContent className="space-y-3"><p className="text-sm text-[var(--app-text-muted)]">Selecciona fuentes PDF y XLSX, revisa el progreso persistido y decide cada hallazgo explícitamente.</p>{error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}</CardContent></Card>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><div className="space-y-5"><DocumentManager projectId={projectId} documents={documents} selectedDocumentIds={selectedDocumentIds} onSelectionChange={setSelectedDocumentIds} onChanged={() => void loadDocuments()} />{runs.length > 0 ? <Card className="theme-surface-card"><CardHeader><CardTitle>Ejecuciones guardadas</CardTitle></CardHeader><CardContent className="space-y-2">{runs.map((run) => <button key={run.id} type="button" onClick={() => setSelectedRun(run)} className={run.id === selectedRun?.id ? "flex w-full items-center justify-between rounded-xl border border-sky-400 bg-sky-50 px-3 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" : "flex w-full items-center justify-between rounded-xl border border-[var(--app-border)] px-3 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"}><span><strong className="block text-[var(--app-text-strong)]">{run.status}</strong><span className="text-xs text-[var(--app-text-muted)]">{new Date(run.createdAt).toLocaleString("es-PE")}</span></span><span className="text-xs text-[var(--app-text-muted)]">{run.progress.percent}%</span></button>)}</CardContent></Card> : null}<ReviewDashboard run={selectedRun} findingCount={findings.findings.length} documentCount={documents.length} /></div><div className="space-y-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[var(--app-text-strong)]">Resultados</h2>{selectedRun ? <Button type="button" variant="ghost" size="sm" onClick={() => { void loadRuns(); void loadFindings(selectedRun); }}><RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar</Button> : null}</div>{loading && runs.length === 0 ? <Card><CardContent className="p-6 text-sm text-[var(--app-text-muted)]" role="status" aria-busy="true">Cargando fuentes y revisiones…</CardContent></Card> : null}{selectedRun ? <><FindingQueue data={findings} filters={filters} onFilterChange={setFilters} onOpenFinding={(id) => setSelectedFinding(findings.findings.find((item) => item.id === id))} /><FindingDetail finding={selectedFinding} canResolve onChanged={() => { void loadFindings(selectedRun); }} /></> : <Card><CardContent className="p-6 text-sm text-[var(--app-text-muted)]">Cuando una revisión termine, sus hallazgos aparecerán aquí.</CardContent></Card>}</div></div>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> { const response = await fetch(url); if (!response.ok) throw new Error("No se pudo cargar la información de revisión."); return await response.json() as T; }
function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function stringValue(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function numberValue(value: unknown, fallback = 0) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function parseRun(value: unknown, budgetId: string): ReviewRunView | null { const row = record(value); if (!row || typeof row.id !== "string") return null; const progressRow = record(row.progressJson) ?? record(row.progress); const warnings = Array.isArray(row.warningsJson) ? row.warningsJson.flatMap(parseWarning) : Array.isArray(row.warnings) ? row.warnings.flatMap(parseWarning) : []; return { id: row.id, budgetId, status: stringValue(row.status, "DRAFT") as ReviewRunView["status"], progress: { stage: stringValue(progressRow?.stage, "validating") as ReviewStage, completed: numberValue(progressRow?.completed), total: numberValue(progressRow?.total, 8), percent: numberValue(progressRow?.percent) }, warnings, createdAt: stringValue(row.createdAt, new Date().toISOString()), updatedAt: stringValue(row.updatedAt, new Date().toISOString()), finishedAt: typeof row.finishedAt === "string" ? row.finishedAt : null }; }
function parseWarning(value: unknown): ReviewWarningView[] { const row = record(value); return row && typeof row.code === "string" && typeof row.message === "string" ? [{ code: row.code, message: row.message, source: typeof row.source === "string" ? row.source : undefined }] : []; }
function parseDocument(value: unknown): ReviewDocumentView[] { const row = record(value); if (!row || typeof row.id !== "string") return []; const version = record(row.currentVersion); return [{ id: row.id, name: stringValue(row.name, stringValue(row.originalFileName, "Documento")), originalFileName: stringValue(row.originalFileName), category: stringValue(row.category, "OTHER"), status: stringValue(row.status, "UPLOADED"), currentVersion: version && typeof version.id === "string" ? { id: version.id, versionNumber: numberValue(version.versionNumber, 1), mimeType: stringValue(version.mimeType), fileSizeBytes: numberValue(version.fileSizeBytes), pageCount: typeof version.pageCount === "number" ? version.pageCount : null, sheetCount: typeof version.sheetCount === "number" ? version.sheetCount : null, extractionStatus: stringValue(version.extractionStatus) } : null, warnings: Array.isArray(row.warnings) ? row.warnings.filter((warning): warning is string => typeof warning === "string") : [] }]; }
function parseProgress(value: unknown, run: ReviewRunView): ReviewRunView { const row = record(value); const progress = record(row?.progress); return { ...run, status: stringValue(row?.status, run.status) as ReviewRunView["status"], progress: { stage: stringValue(progress?.stage, run.progress.stage) as ReviewStage, completed: numberValue(progress?.completed, run.progress.completed), total: numberValue(progress?.total, run.progress.total), percent: numberValue(progress?.percent, run.progress.percent) }, warnings: Array.isArray(row?.warnings) ? row.warnings.flatMap(parseWarning) : run.warnings }; }
function parseFindingPage(value: PaginatedFindings): PaginatedFindings { return { findings: Array.isArray(value.findings) ? value.findings : [], page: numberValue(value.page, 1), pageSize: numberValue(value.pageSize, 25), hasNextPage: value.hasNextPage === true }; }
