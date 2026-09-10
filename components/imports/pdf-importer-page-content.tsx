"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { ImportProgressPanel, type ImportProgressPanelStep } from "@/components/imports/import-progress-panel";
import { ImportWarningSummary } from "@/components/imports/import-warning-summary";
import { PreviewDebugPanel } from "@/components/ai/debug-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionPagination } from "@/components/ui/section-pagination";
import { calculateDecimalDifference, calculatePdfImportDraftTotals } from "@/lib/pdf-import/calculations";
import type { PdfAiImportDraft, PdfImportAiDebug, PdfImportDocumentRole, PdfImportLink, PdfImportSourceEvidence, PdfImportValidation, PdfImportedBudgetFooterRow, PdfImportedBudgetItem, PdfImportedBudgetLevel } from "@/lib/pdf-import/types";

type RequestState = "idle" | "loading" | "success" | "error";

type CompanyOption = {
  id: string;
  name: string;
};

type PdfImporterPageContentProps = {
  companies: CompanyOption[];
  initialDraft?: PdfAiImportDraft;
};

type PdfImportResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  resourceCount: number;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
};

type PdfDraftStreamEvent =
  | { type: "progress"; phase: "preparing" | "ocr" | "structuring" | "completed"; status?: "started" | "completed"; pageNumber?: number; totalPages?: number; fileName?: string; detail: string }
  | { type: "result"; draft: PdfAiImportDraft }
  | { type: "error"; error: string; aiDebug?: PdfImportAiDebug[] };

const progressSteps: ImportProgressPanelStep[] = [
  { label: "Subiendo" },
  { label: "Extrayendo" },
  { label: "Vinculando" },
  { label: "Revisando" },
];

export function PdfImporterPageContent({ companies, initialDraft }: PdfImporterPageContentProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileRoles, setFileRoles] = useState<Record<string, PdfImportDocumentRole>>({});
  const [selectedRole, setSelectedRole] = useState<PdfImportDocumentRole>("AUTO");
  const [dragOver, setDragOver] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");
  const [currency, setCurrency] = useState("PEN");
  const [priceTolerance, setPriceTolerance] = useState("0.01");
  const [draftState, setDraftState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [draft, setDraft] = useState<PdfAiImportDraft | null>(initialDraft ?? null);
  const [importResult, setImportResult] = useState<PdfImportResult | null>(null);
  const [error, setError] = useState("");
  const [aiDebug, setAiDebug] = useState<PdfImportAiDebug[]>(initialDraft?.aiDebug ?? []);
  const [progress, setProgress] = useState(2);
  const [progressDetail, setProgressDetail] = useState("Preparando OCR y validando el paquete PDF.");
  const [progressPage, setProgressPage] = useState<number | null>(null);
  const [progressTotal, setProgressTotal] = useState<number | null>(null);
  const [progressFile, setProgressFile] = useState<string | undefined>();
  const [progressStartedAt, setProgressStartedAt] = useState<number | null>(null);
  const [getCurrentTimestamp] = useState(() => () => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draftState !== "loading" || progressStartedAt === null) return undefined;
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - progressStartedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [draftState, progressStartedAt]);

  const criticalValidationCount = useMemo(
    () => draft?.validations.filter((validation) => validation.severity === "error").length ?? 0,
    [draft],
  );
  const canCreateDraft = files.length > 0 && companyId.length > 0 && draftState !== "loading";
  const canImport = draft != null && companyId.length > 0 && criticalValidationCount === 0 && importState !== "loading";

  function onFilesSelected(nextFiles: FileList | null) {
    const selectedFiles = Array.from(nextFiles ?? []);
    setFiles(selectedFiles);
    setDraft(null);
    setAiDebug([]);
    setProgress(2);
    setProgressDetail("Preparando OCR y validando el paquete PDF.");
    setProgressPage(null);
    setProgressTotal(null);
    setProgressFile(undefined);
    setImportResult(null);
    setFileRoles(Object.fromEntries(selectedFiles.map((file) => [file.name, selectedRole === "AUTO" ? inferInitialRole(file.name) : selectedRole])));
  }

  function onFilesDropped(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    onFilesSelected(event.dataTransfer.files);
  }

  async function createDraft() {
    if (!canCreateDraft) {
      setError(files.length === 0 ? "Selecciona al menos un PDF." : "Selecciona una empresa destino.");
      setDraftState("error");
      return;
    }

    setDraftState("loading");
    setImportState("idle");
    setError("");
    setImportResult(null);
    setProgress(2);
    setProgressDetail("Preparando OCR y validando el paquete PDF.");
    setProgressStartedAt(getCurrentTimestamp());
    setElapsedSeconds(0);

    const formData = createFormData();

    try {
      const response = await fetch("/api/imports/pdf/draft", {
        method: "POST",
        headers: { Accept: "application/x-ndjson" },
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; aiDebug?: PdfImportAiDebug[] } | null;
        setAiDebug(body?.aiDebug ?? []);
        throw new Error(body?.error ?? "No se pudo generar el draft PDF.");
      }

      const body = await readPdfDraftStream(response, (event) => {
        if (event.type !== "progress") return;
        setProgressDetail(event.detail);
        if (event.pageNumber !== undefined) setProgressPage(event.pageNumber);
        if (event.totalPages !== undefined) setProgressTotal(event.totalPages);
        if (event.fileName) setProgressFile(event.fileName);
        setProgress(event.phase === "ocr" && event.totalPages
          ? Math.min(88, 5 + ((event.pageNumber ?? 0) / event.totalPages) * 83)
          : event.phase === "structuring" ? 92 : event.phase === "completed" ? 100 : 2);
      });

      if (body.type === "error") {
        setAiDebug(body.aiDebug ?? []);
        throw new Error(body.error);
      }
      setDraft(body.draft);
      setAiDebug(body.draft.aiDebug ?? []);
      setProgress(100);
      setDraftState("success");
    } catch (nextError) {
      setDraftState("error");
      setError(nextError instanceof Error ? nextError.message : "No se pudo generar el draft PDF.");
    }
  }

  async function importDraft() {
    if (!draft || !companyId) {
      setError("Genera un draft y selecciona una empresa antes de importar.");
      setImportState("error");
      return;
    }

    setImportState("loading");
    setError("");

    try {
      const response = await fetch("/api/imports/pdf/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, draft }),
      });
      const body = (await response.json().catch(() => null)) as (PdfImportResult & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo importar el draft PDF.");
      }

      setImportResult(body);
      setImportState("success");
    } catch (nextError) {
      setImportState("error");
      setError(nextError instanceof Error ? nextError.message : "No se pudo importar el draft PDF.");
    }
  }

  function createFormData() {
    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("projectName", projectName);
    formData.set("currency", currency);
    formData.set("priceTolerance", priceTolerance);
    formData.set("fileRoles", JSON.stringify(fileRoles));
    files.forEach((file) => formData.append("files", file));
    return formData;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <FileText className="h-4 w-4 text-sky-600" />
              PDFs del proyecto
            </div>
            <p className="text-sm text-[var(--app-text-muted)]">
              Sube presupuesto, APUs y subpartidas. Los PDFs escaneados quedaran marcados para OCR/vision cuando el proveedor este configurado.
            </p>
          </div>
          <Badge className={draftState === "success" ? "theme-status-success" : "theme-status-info"}>
            {files.length} PDF{files.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="mt-5 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.35fr)_minmax(14rem,1fr)_7rem_9rem_auto]">
          <div className="min-w-0 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]" htmlFor="pdf-import-role">
              Tipo de archivo
            </label>
            <select
              id="pdf-import-role"
              aria-label="Tipo de archivo PDF"
              className="h-10 w-full rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as PdfImportDocumentRole)}
            >
              <option value="AUTO">Detectar automáticamente</option>
              <option value="BUDGET">Presupuesto</option>
              <option value="APU">Precios unitarios (APU)</option>
              <option value="SUBPARTIDAS">Subpartidas</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div className="min-w-0 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]" htmlFor="pdf-import-company">
              Empresa destino
            </label>
            <select
              id="pdf-import-company"
              aria-label="Empresa destino"
              className="h-10 w-full rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500"
              disabled={companies.length === 0}
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              {companies.length === 0 ? <option value="">Sin empresas</option> : companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>
          <div className="min-w-0 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]" htmlFor="pdf-import-currency">Moneda</label>
            <Input id="pdf-import-currency" aria-label="Moneda" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          </div>
          <div className="min-w-0 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]" htmlFor="pdf-import-tolerance">Tolerancia</label>
            <Input id="pdf-import-tolerance" aria-label="Tolerancia" value={priceTolerance} onChange={(event) => setPriceTolerance(event.target.value)} />
          </div>
          <input ref={fileInputRef} accept=".pdf,application/pdf" multiple type="file" className="hidden" onChange={(event) => { onFilesSelected(event.target.files); event.target.value = ""; }} />
          <Button type="button" variant="outline" className="h-10 shrink-0 gap-2" disabled={draftState === "loading"} onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Subir archivos PDF
          </Button>
        </div>

        <div
          className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center transition ${dragOver ? "border-blue-400 bg-blue-50" : "border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)]"}`}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onFilesDropped}
        >
          <Paperclip className="mx-auto mb-2 h-5 w-5 text-[var(--app-text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--app-text-muted)]">Arrastra y suelta archivos aquí o usa el botón superior</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">PDF de presupuesto, precios unitarios (APU) y subpartidas — máx. 10 archivos y 100 MB</p>
        </div>

        <div className="mt-3">
          <Input
            aria-label="Nombre del proyecto"
            placeholder="Nombre del proyecto detectado o manual"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />
        </div>

        {files.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
            <div className="grid grid-cols-[minmax(0,1fr)_180px] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
              <span>Archivo</span>
              <span>Tipo</span>
            </div>
            {files.map((file) => (
              <div className="grid grid-cols-[minmax(0,1fr)_180px] items-center gap-3 border-t border-[var(--app-border-soft)] px-3 py-2" key={file.name}>
                <span className="truncate text-sm text-[var(--app-text-strong)]">{file.name}</span>
                <select
                  aria-label={`Tipo de ${file.name}`}
                  className="h-9 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                  value={fileRoles[file.name] ?? "AUTO"}
                  onChange={(event) => setFileRoles((current) => ({ ...current, [file.name]: event.target.value as PdfImportDocumentRole }))}
                >
                  <option value="AUTO">Detectar</option>
                  <option value="BUDGET">Presupuesto</option>
                  <option value="APU">APU</option>
                  <option value="SUBPARTIDAS">Subpartidas</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="gap-2" disabled={!canCreateDraft} onClick={createDraft}>
            {draftState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Generar draft
          </Button>
          <Button className="gap-2" disabled={!canImport} onClick={importDraft} variant="outline">
            {importState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Importar proyecto
          </Button>
        </div>

        {draftState === "loading" ? (
          <ImportProgressPanel
            activeStepIndex={2}
            detail={progressPage && progressTotal ? `Procesando ${progressFile ?? "PDF"}: página ${progressPage} de ${progressTotal}.` : "Extrayendo texto, clasificando documentos y vinculando partidas con APUs."}
            progress={progress}
            progressDetail={`${progressDetail} · ${elapsedSeconds}s transcurridos`}
            status="running"
            steps={progressSteps}
            title="Generando draft PDF"
          />
        ) : null}

        {error ? <InlineMessage message={error} /> : null}
        {aiDebug.length > 0 ? <PreviewDebugPanel debug={createPdfImportDebugView(aiDebug)} title="Diagnóstico IA del importador PDF" /> : null}
        {companies.length === 0 ? <InlineMessage message="Crea una empresa antes de importar proyectos desde PDF." /> : null}
      </section>

      {importResult ? (
        <section className="theme-status-success rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Importacion PDF completada
          </div>
          <p className="mt-2 text-sm">
            {importResult.projectName}: {importResult.itemCount} partidas, {importResult.apuCount} APUs y {importResult.resourceCount} recursos.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { window.location.href = `/projects/${importResult.projectId}`; }}>
              Proyecto
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { window.location.href = `/budgets/${importResult.generalBudgetId}`; }}>
              Presupuesto
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {draft ? <DraftPreview draft={draft} criticalValidationCount={criticalValidationCount} onDraftChange={setDraft} /> : null}
    </div>
  );
}

function createPdfImportDebugView(debug: PdfImportAiDebug[]) {
  return {
    structuredParseStatus: "failed" as const,
    context: {
      stage: "pdf_import_ocr",
      requests: debug.length,
      calls: debug.map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        fileName: entry.fileName,
        pageNumber: entry.pageNumber,
        url: entry.request.url,
        status: entry.response.status,
        statusText: entry.response.statusText,
        headers: entry.response.headers,
      })),
    },
    requestBody: debug.length === 1 ? debug[0]?.request.body : { requests: debug.map((entry) => entry.request.body) },
    ai: {
      answer: "",
      rawAnswer: debug.map((entry) => JSON.stringify(entry.response.body)).join("\n\n"),
      structuredParseStatus: "failed" as const,
    },
    validationWarnings: debug.map((entry) => `${entry.provider} · pagina ${entry.pageNumber} · HTTP ${entry.response.status}${entry.error ? ` · ${entry.error}` : ""}`),
  };
}

async function readPdfDraftStream(response: Response, onEvent: (event: PdfDraftStreamEvent) => void): Promise<Extract<PdfDraftStreamEvent, { type: "result" | "error" }>> {
  if (!response.body) throw new Error("El servidor no devolvió un flujo de progreso.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalEvent: Extract<PdfDraftStreamEvent, { type: "result" | "error" }> | null = null;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as PdfDraftStreamEvent;
      onEvent(event);
      if (event.type === "result" || event.type === "error") finalEvent = event;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const event = JSON.parse(buffer) as PdfDraftStreamEvent;
    onEvent(event);
    if (event.type === "result" || event.type === "error") finalEvent = event;
  }

  if (!finalEvent) throw new Error("El servidor cerró el progreso sin devolver un resultado.");
  return finalEvent;
}

function DraftPreview({
  draft,
  criticalValidationCount,
  onDraftChange,
}: {
  draft: PdfAiImportDraft;
  criticalValidationCount: number;
  onDraftChange: (draft: PdfAiImportDraft) => void;
}) {
  const itemCount = draft.budgets.reduce((sum, budget) => sum + budget.items.length, 0);
  const apuCount = draft.apus.length;
  const subpartidaCount = draft.subpartidas.length;
  const resourceCount = draft.resources.length;

  return (
    <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--app-text-strong)]">{draft.project.name}</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {itemCount} partidas detectadas, {apuCount} APUs, {subpartidaCount} subpartidas, {resourceCount} recursos.
          </p>
        </div>
        <Badge className={criticalValidationCount > 0 ? "theme-status-danger" : "theme-status-success"}>
          {criticalValidationCount} errores criticos
        </Badge>
      </div>

      <ImportWarningSummary warnings={[...draft.warnings, ...draft.validations.map((validation) => validation.message)]} />

      {draft.budgets.some((budget) => budget.levels.length > 0) ? (
        <div className="mt-5 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Estructura detectada</p>
          <div className="mt-2 space-y-1">
            {draft.budgets.flatMap((budget) => budget.levels).map((level) => (
              <div
                className={level.type === "TITLE" ? "text-sm font-semibold text-[var(--app-text-strong)]" : "pl-4 text-sm text-[var(--app-text-muted)]"}
                key={level.id}
              >
                <span className="mr-2 font-mono text-xs">{level.code}</span>
                {level.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
        <div className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px_90px_130px] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
          <span>Codigo</span>
          <span>Partida</span>
          <span>Und</span>
          <span>Metrado</span>
          <span>P.U.</span>
          <span>Parcial</span>
          <span>Verificación APU</span>
        </div>
        {draft.budgets.flatMap((budget) => buildBudgetTableRows(budget.items, budget.levels)).map((row) => (
          row.kind === "LEVEL" ? (
            <div className={row.level.type === "TITLE" ? "border-t border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)]" : "border-t border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-3 py-2 pl-7 text-sm font-medium text-[var(--app-text-muted)]"} key={row.level.id}>
              <span className="mr-2 font-mono text-xs">{row.level.code}</span>
              {row.level.name}
            </div>
          ) : (
            <div
              className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px_90px_130px] items-center gap-2 border-t border-[var(--app-border-soft)] px-3 py-2 text-sm"
              key={row.item.id}
            >
              <span className="font-mono text-xs text-[var(--app-text-muted)]">{row.item.code}</span>
              <Input
                aria-label={`Descripcion ${row.item.code}`}
                className="h-8"
                value={row.item.description}
                onChange={(event) => onDraftChange(updateBudgetItemField(draft, row.item.id, "description", event.target.value))}
              />
              <Input
                aria-label={`Unidad ${row.item.code}`}
                className="h-8"
                value={row.item.unit}
                onChange={(event) => onDraftChange(updateBudgetItemField(draft, row.item.id, "unit", event.target.value))}
              />
              <Input
                aria-label={`Cantidad ${row.item.code}`}
                className="h-8"
                value={row.item.quantity}
                onChange={(event) => onDraftChange(updateBudgetItemField(draft, row.item.id, "quantity", event.target.value))}
              />
              <Input
                aria-label={`Precio unitario ${row.item.code}`}
                className="h-8"
                value={row.item.unitPrice}
                onChange={(event) => onDraftChange(updateBudgetItemField(draft, row.item.id, "unitPrice", event.target.value))}
              />
              <span>{row.item.partial}</span>
              <ApuVerification draft={draft} item={row.item} />
            </div>
          )
        ))}
      </div>

      {draft.budgets.some((budget) => (budget.footerRows?.length ?? 0) > 0) ? (
        <PdfBudgetFooterPreview budgets={draft.budgets} />
      ) : null}

      {draft.subpartidas.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
          <div className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
            <span>Codigo</span>
            <span>Subpartida</span>
            <span>Und</span>
            <span>Rend.</span>
            <span>P.U.</span>
          </div>
          {draft.subpartidas.slice(0, 8).map((subpartida) => (
            <div
              className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px] border-t border-[var(--app-border-soft)] px-3 py-2 text-sm"
              key={subpartida.id}
            >
              <span className="font-mono text-xs text-[var(--app-text-muted)]">{subpartida.code}</span>
              <span className="truncate text-[var(--app-text-strong)]">{subpartida.description}</span>
              <span>{subpartida.unit}</span>
              <span>{subpartida.performance ?? "-"}</span>
              <span>{subpartida.unitPrice}</span>
            </div>
          ))}
        </div>
      ) : null}

      <ReviewPanel draft={draft} onDraftChange={onDraftChange} />
    </section>
  );
}

function ApuVerification({ draft, item }: { draft: PdfAiImportDraft; item: PdfImportedBudgetItem }) {
  const link = draft.links.find((entry) => entry.kind === "BUDGET_ITEM_APU" && entry.fromId === item.id);
  const apu = link?.toId ? draft.apus.find((entry) => entry.id === link.toId) : undefined;
  const baseClass = "truncate text-xs font-medium";

  if (!link || link.status === "MISSING_APU") {
    return <span className={`${baseClass} text-rose-700`} title="No se encontró un APU compatible">Sin APU</span>;
  }
  if (link.status === "MATCHED") {
    return <span className={`${baseClass} text-emerald-700`} title="APU y precio verificados">OK</span>;
  }
  if (link.status === "PRICE_MISMATCH" && apu) {
    const difference = calculateDecimalDifference(item.unitPrice, apu.totalUnitCost).toFixed(2);
    return <span className={`${baseClass} text-amber-700`} title={link.reason}>Diferencia: {difference}</span>;
  }
  const label = link.status === "UNIT_MISMATCH" ? "Unidad incompatible" : link.status === "AMBIGUOUS" ? "APU ambiguo" : "Revisar APU";
  return <span className={`${baseClass} text-amber-700`} title={link.reason}>{label}</span>;
}

type PdfBudgetTableRow =
  | { kind: "LEVEL"; level: PdfImportedBudgetLevel }
  | { kind: "ITEM"; item: PdfImportedBudgetItem };

function buildBudgetTableRows(items: PdfImportedBudgetItem[], levels: PdfImportedBudgetLevel[]): PdfBudgetTableRow[] {
  const rows: PdfBudgetTableRow[] = [];
  const renderedLevels = new Set<string>();
  const orderedLevels = [...levels].sort((left, right) => left.sortOrder - right.sortOrder);

  for (const item of items) {
    for (const level of orderedLevels) {
      if (!renderedLevels.has(level.id) && item.code.startsWith(`${level.code}.`)) {
        rows.push({ kind: "LEVEL", level });
        renderedLevels.add(level.id);
      }
    }
    rows.push({ kind: "ITEM", item });
  }

  return rows;
}

function PdfBudgetFooterPreview({ budgets }: { budgets: PdfAiImportDraft["budgets"] }) {
  const footerRows = budgets.flatMap((budget) => budget.footerRows ?? []);
  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]">
      <div className="border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-4">
        <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">Resumen / pie de presupuesto</h3>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">Valores detectados en el PDF para revisión antes de importar.</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-[var(--app-surface)] text-xs uppercase text-[var(--app-text-muted)]">
            <tr><th className="px-4 py-2">Variable</th><th className="px-3 py-2">Descripción</th><th className="px-3 py-2">Tasa</th><th className="px-3 py-2 text-right">Valor</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-border-soft)]">
            {footerRows.map((row) => <PdfFooterRow key={row.id} row={row} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PdfFooterRow({ row }: { row: PdfImportedBudgetFooterRow }) {
  return (
    <tr className={row.highlight ? "bg-[var(--app-surface-elevated)] text-[var(--app-text-strong)]" : "text-[var(--app-text-muted)]"}>
      <td className="whitespace-nowrap px-4 py-2 font-medium">{row.variable}</td>
      <td className="px-3 py-2">{row.description}</td>
      <td className="px-3 py-2">{row.rate ?? "-"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatPdfMoney(row.value)}</td>
    </tr>
  );
}

function formatPdfMoney(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value;
}

type ReviewIssue = {
  id: string;
  title: string;
  detail: string;
  evidence?: PdfImportSourceEvidence;
  link?: PdfImportLink;
  validation?: PdfImportValidation;
};

function ReviewPanel({ draft, onDraftChange }: { draft: PdfAiImportDraft; onDraftChange: (draft: PdfAiImportDraft) => void }) {
  const groups = buildReviewGroups(draft);
  const totalIssues = groups.reduce((sum, group) => sum + group.items.length, 0);
  const [selectedApuByLinkId, setSelectedApuByLinkId] = useState<Record<string, string>>({});
  const [selectedBudgetItemByLinkId, setSelectedBudgetItemByLinkId] = useState<Record<string, string>>({});
  const [selectedSubpartidaByLinkId, setSelectedSubpartidaByLinkId] = useState<Record<string, string>>({});
  const [reviewPageByGroup, setReviewPageByGroup] = useState<Record<string, number>>({});
  const budgetItems = draft.budgets.flatMap((budget) => budget.items);

  if (totalIssues === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-[var(--app-border-soft)] pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">Revision requerida</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Revisa conflictos, recursos nuevos y evidencias de baja confianza antes de importar.
          </p>
        </div>
        <Badge className="theme-status-warning">{totalIssues} observaciones</Badge>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {groups.filter((group) => group.items.length > 0).map((group) => {
          const currentPage = reviewPageByGroup[group.title] ?? 1;
          const totalPages = Math.ceil(group.items.length / 6);
          const visibleItems = group.items.slice((currentPage - 1) * 6, currentPage * 6);

          return (
          <section className="overflow-hidden rounded-xl border border-[var(--app-border-soft)]" key={group.title}>
            <div className="flex items-center justify-between bg-[var(--app-surface-elevated)] px-3 py-2">
              <h4 className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">{group.title}</h4>
              <Badge>{group.items.length}</Badge>
            </div>
            <div className="divide-y divide-[var(--app-border-soft)]">
              {visibleItems.map((issue) => (
                <div className="px-3 py-2" key={issue.id}>
                  <div className="text-sm font-medium text-[var(--app-text-strong)]">{issue.title}</div>
                  <div className="mt-1 text-xs text-[var(--app-text-muted)]">{issue.detail}</div>
                  {issue.evidence ? (
                    <div className="mt-1 font-mono text-xs text-[var(--app-text-muted)]">
                      {issue.evidence.sourceFileName} p. {issue.evidence.sourcePage}
                    </div>
                  ) : null}
                  {issue.link?.kind === "BUDGET_ITEM_APU" && issue.link.status === "MISSING_APU" ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Seleccionar APU para ${issue.title.replace(/^[^·]+·\s*/, "")}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                        value={selectedApuByLinkId[issue.link.id] ?? ""}
                        onChange={(event) => setSelectedApuByLinkId((current) => ({ ...current, [issue.link!.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar APU</option>
                        {draft.apus.map((apu) => (
                          <option key={apu.id} value={apu.id}>
                            {apu.budgetItemCode ?? apu.id} - {apu.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDraftChange(resolveMissingApuLink(draft, issue.link!, selectedApuByLinkId[issue.link!.id] ?? ""))}
                      >
                        Vincular APU
                      </Button>
                    </div>
                  ) : null}
                  {issue.link?.kind === "BUDGET_ITEM_APU" && issue.link.status === "MISSING_BUDGET_ITEM" ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Seleccionar partida para ${issue.title}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                        value={selectedBudgetItemByLinkId[issue.link.id] ?? ""}
                        onChange={(event) => setSelectedBudgetItemByLinkId((current) => ({ ...current, [issue.link!.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar partida</option>
                        {budgetItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.code} - {item.description}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onDraftChange(resolveOrphanApuLink(draft, issue.link!, selectedBudgetItemByLinkId[issue.link!.id] ?? ""))
                        }
                      >
                        Vincular partida
                      </Button>
                    </div>
                  ) : null}
                  {issue.link?.kind === "APU_SUBPARTIDA" && (issue.link.status === "AMBIGUOUS" || issue.link.status === "NEEDS_REVIEW") ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Seleccionar subpartida para ${issue.title}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                        value={selectedSubpartidaByLinkId[issue.link.id] ?? ""}
                        onChange={(event) => setSelectedSubpartidaByLinkId((current) => ({ ...current, [issue.link!.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar subpartida</option>
                        {draft.subpartidas.map((subpartida) => (
                          <option key={subpartida.id} value={subpartida.id}>
                            {subpartida.code} - {subpartida.description}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onDraftChange(resolveSubpartidaLink(draft, issue.link!, selectedSubpartidaByLinkId[issue.link!.id] ?? ""))
                        }
                      >
                        Vincular subpartida
                      </Button>
                    </div>
                  ) : null}
                  {issue.link?.status === "PRICE_MISMATCH" && issue.link.toId ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={() => onDraftChange(approvePriceDifference(draft, issue.link!))}
                    >
                      Aprobar diferencia
                    </Button>
                  ) : null}
                  {issue.validation?.code === "MISSING_PERFORMANCE" ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={() => onDraftChange(approveMissingPerformance(draft, issue.validation!))}
                    >
                      Aprobar rendimiento 1
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="px-3 py-3">
              <SectionPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPrevious={() => setReviewPageByGroup((current) => ({ ...current, [group.title]: Math.max(1, currentPage - 1) }))}
                onNext={() => setReviewPageByGroup((current) => ({ ...current, [group.title]: Math.min(totalPages, currentPage + 1) }))}
              />
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}

function buildReviewGroups(draft: PdfAiImportDraft) {
  const budgetItems = draft.budgets.flatMap((budget) => budget.items);
  const apuRows = draft.apus.flatMap((apu) => apu.rows);
  const budgetItemsById = new Map(budgetItems.map((item) => [item.id, item]));
  const apusById = new Map(draft.apus.map((apu) => [apu.id, apu]));
  const apuRowsById = new Map(apuRows.map((row) => [row.id, row]));

  const missingApus = draft.links
    .filter((link) => link.kind === "BUDGET_ITEM_APU" && link.status === "MISSING_APU")
    .map((link): ReviewIssue | null => {
      const item = budgetItemsById.get(link.fromId);
      return item
        ? { id: link.id, title: `${item.code} · ${item.description}`, detail: link.reason, evidence: item.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const missingBudgetItems = draft.links
    .filter((link) => link.kind === "BUDGET_ITEM_APU" && link.status === "MISSING_BUDGET_ITEM")
    .map((link): ReviewIssue | null => {
      const apu = apusById.get(link.fromId);
      return apu
        ? { id: link.id, title: apu.name, detail: link.reason, evidence: apu.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const priceDifferences = draft.links
    .filter((link) => link.kind === "BUDGET_ITEM_APU" && link.status === "PRICE_MISMATCH")
    .map((link): ReviewIssue | null => {
      const item = budgetItemsById.get(link.fromId);
      return item
        ? { id: link.id, title: `${item.code} · ${item.description}`, detail: link.reason, evidence: item.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const ambiguousSubpartidas = draft.links
    .filter((link) => link.kind === "APU_SUBPARTIDA" && (link.status === "AMBIGUOUS" || link.status === "NEEDS_REVIEW"))
    .map((link): ReviewIssue | null => {
      const row = apuRowsById.get(link.fromId);
      return row
        ? { id: link.id, title: row.description, detail: link.reason, evidence: row.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const newResources = draft.resources.map((resource): ReviewIssue => ({
    id: resource.id,
    title: resource.description,
    detail: `${resource.category} - ${resource.unit} - ${resource.unitPrice} ${resource.currency}`,
    evidence: resource.evidence,
  }));

  const lowConfidenceEvidence = collectLowConfidenceEvidence(draft).map((evidence, index): ReviewIssue => ({
    id: `${evidence.sourceFileName}-${evidence.sourcePage}-${index}`,
    title: `${evidence.sourceFileName} p. ${evidence.sourcePage}`,
    detail: `Confianza ${(evidence.confidence * 100).toFixed(0)}%.`,
    evidence,
  }));

  const missingPerformances = draft.validations
    .filter((validation) => validation.code === "MISSING_PERFORMANCE" && validation.entityId)
    .map((validation): ReviewIssue | null => {
      const apu = apusById.get(validation.entityId!);
      return apu
        ? { id: validation.id, title: `${apu.budgetItemCode ?? apu.id} · ${apu.name}`, detail: validation.message, evidence: apu.evidence, validation }
        : null;
    })
    .filter(isReviewIssue);

  return [
    { title: "Partidas sin APU", items: missingApus },
    { title: "APUs sin partida", items: missingBudgetItems },
    { title: "Diferencias de precio", items: priceDifferences },
    { title: "APUs sin rendimiento", items: missingPerformances },
    { title: "Subpartidas ambiguas", items: ambiguousSubpartidas },
    { title: "Recursos nuevos", items: newResources },
    { title: "Paginas OCR de baja confianza", items: lowConfidenceEvidence },
  ];
}

type EditableBudgetItemField = "description" | "unit" | "quantity" | "unitPrice";

function updateBudgetItemField(draft: PdfAiImportDraft, itemId: string, field: EditableBudgetItemField, value: string): PdfAiImportDraft {
  const nextDraft: PdfAiImportDraft = {
    ...draft,
    budgets: draft.budgets.map((budget) => ({
      ...budget,
      items: budget.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    })),
  };

  return calculatePdfImportDraftTotals(nextDraft);
}

function approvePriceDifference(draft: PdfAiImportDraft, link: PdfImportLink): PdfAiImportDraft {
  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? { ...current, status: "MATCHED", confidence: Math.max(current.confidence, 0.8), reason: `${current.reason} Aprobado por revision humana.` }
        : current,
    ),
    validations: draft.validations.filter((validation) => !(validation.code === "PRICE_MISMATCH" && validation.entityId === link.fromId)),
    reviewApprovals: addReviewApproval(
      draft,
      `approval-${link.id}`,
      "PRICE_MISMATCH",
      link.fromId,
      "Diferencia de precio aprobada por revision humana.",
    ),
    warnings: [...draft.warnings, `Diferencia de precio aprobada para ${link.fromId}.`],
  };
}

function approveMissingPerformance(draft: PdfAiImportDraft, validation: PdfImportValidation): PdfAiImportDraft {
  return {
    ...draft,
    validations: draft.validations.filter((current) => current.id !== validation.id),
    reviewApprovals: addReviewApproval(
      draft,
      `approval-${validation.id}`,
      "MISSING_PERFORMANCE",
      validation.entityId ?? "",
      "Rendimiento 1 asumido aprobado por revision humana.",
    ),
    warnings: [...draft.warnings, `Rendimiento 1 aprobado para ${validation.entityId ?? "APU"}.`],
  };
}

function resolveMissingApuLink(draft: PdfAiImportDraft, link: PdfImportLink, apuId: string): PdfAiImportDraft {
  if (apuId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? { ...current, toId: apuId, status: "MATCHED", confidence: Math.max(current.confidence, 0.8), reason: `${current.reason} Vinculado por revision humana.` }
        : current,
    ),
    warnings: [...draft.warnings, `APU vinculado para ${link.fromId}.`],
  };
}

function resolveOrphanApuLink(draft: PdfAiImportDraft, link: PdfImportLink, budgetItemId: string): PdfAiImportDraft {
  if (budgetItemId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? {
            ...current,
            fromId: budgetItemId,
            toId: link.fromId,
            status: "MATCHED",
            confidence: Math.max(current.confidence, 0.8),
            reason: `${current.reason} Vinculado por revision humana.`,
          }
        : current,
    ),
    warnings: [...draft.warnings, `Partida vinculada para ${link.fromId}.`],
  };
}

function resolveSubpartidaLink(draft: PdfAiImportDraft, link: PdfImportLink, subpartidaId: string): PdfAiImportDraft {
  if (subpartidaId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? { ...current, toId: subpartidaId, status: "MATCHED", confidence: Math.max(current.confidence, 0.8), reason: `${current.reason} Vinculado por revision humana.` }
        : current,
    ),
    warnings: [...draft.warnings, `Subpartida vinculada para ${link.fromId}.`],
  };
}

function addReviewApproval(draft: PdfAiImportDraft, id: string, validationCode: string, entityId: string, reason: string) {
  const existingApprovals = draft.reviewApprovals ?? [];
  if (existingApprovals.some((approval) => approval.id === id)) {
    return existingApprovals;
  }

  return [...existingApprovals, { id, validationCode, entityId, reason }];
}

function collectLowConfidenceEvidence(draft: PdfAiImportDraft) {
  const evidenceItems = [
    ...draft.budgets.flatMap((budget) => budget.items.map((item) => item.evidence)),
    ...draft.apus.flatMap((apu) => [apu.evidence, ...apu.rows.map((row) => row.evidence)]),
    ...draft.subpartidas.flatMap((subpartida) => [subpartida.evidence, ...subpartida.rows.map((row) => row.evidence)]),
    ...draft.resources.map((resource) => resource.evidence),
  ];
  const seen = new Set<string>();

  return evidenceItems.filter((evidence) => {
    const key = `${evidence.sourceFileName}:${evidence.sourcePage}`;
    if (evidence.confidence >= 0.65 || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isReviewIssue(issue: ReviewIssue | null): issue is ReviewIssue {
  return issue != null;
}

function InlineMessage({ message }: { message: string }) {
  return (
    <div className="theme-status-warning mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function inferInitialRole(fileName: string): PdfImportDocumentRole {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("apu") || normalized.includes("analisis")) {
    return "APU";
  }
  if (normalized.includes("sub")) {
    return "SUBPARTIDAS";
  }
  if (normalized.includes("presupuesto")) {
    return "BUDGET";
  }
  return "AUTO";
}
