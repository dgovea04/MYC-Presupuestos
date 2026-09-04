"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Database, ExternalLink, FileSearch, Loader2, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportBudgetFooterPreview } from "@/components/imports/import-budget-footer-preview";
import { ImportProgressPanel, type ImportProgressPanelStep } from "@/components/imports/import-progress-panel";
import { ImportWarningSummary, ImportWarningsBadge } from "@/components/imports/import-warning-summary";
import type { S10ImportDraftPreview, S10ImportDraftPreviewRow } from "@/lib/s10/import-preview";
import type { DbProjectSummary } from "@/lib/db-import/types";

type RequestState = "idle" | "loading" | "success" | "error";
type SourceMode = "upload" | "local_path";

type CompanyOption = { id: string; name: string };
type ImportResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  resourceCount: number;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
};

type Props = {
  companies: CompanyOption[];
  localToolsEnabled: boolean;
};

const previewSteps: ImportProgressPanelStep[] = [
  { label: "Preparando" },
  { label: "Leyendo SQLite" },
  { label: "Convirtiendo" },
  { label: "Previsualizando" },
];
const importSteps: ImportProgressPanelStep[] = [
  { label: "Preparando" },
  { label: "Validando" },
  { label: "Creando proyecto" },
  { label: "Guardando APUs" },
];

export function DbImporterPageContent({ companies, localToolsEnabled }: Props) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [localPath, setLocalPath] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projects, setProjects] = useState<DbProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [subBudgetId, setSubBudgetId] = useState("");
  const [discoveryState, setDiscoveryState] = useState<RequestState>("idle");
  const [previewState, setPreviewState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [preview, setPreview] = useState<S10ImportDraftPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const subBudgetOptions = selectedProject?.subBudgets ?? [];
  const selectedBudget = useMemo(() => {
    const budgets = preview?.budgets.filter((budget) => budget.kind === "SUB_BUDGET") ?? [];
    return budgets.find((budget) => budget.id === selectedBudgetId) ?? budgets[0] ?? null;
  }, [preview, selectedBudgetId]);
  const visibleRows = useMemo(() => filterRows(selectedBudget?.rows ?? [], itemSearch), [itemSearch, selectedBudget]);
  const itemCount = preview?.budgets.filter((budget) => budget.kind === "SUB_BUDGET").reduce((sum, budget) => sum + budget.itemCount, 0) ?? 0;

  async function discoverProjects() {
    setDiscoveryState("loading");
    setError("");
    setProjects([]);
    setProjectId("");
    setSubBudgetId("");
    setPreview(null);
    setImportResult(null);

    try {
      const result = sourceMode === "upload"
        ? await requestUploadDiscovery(file)
        : await requestJson<{ projects: DbProjectSummary[] }>(`/api/imports/db/local/projects?path=${encodeURIComponent(localPath.trim())}`);
      setProjects(result.projects);
      setProjectId(result.projects[0]?.id ?? "");
      setSubBudgetId(result.projects[0]?.subBudgets[0]?.id ?? "");
      setDiscoveryState("success");
      if (result.projects.length === 0) setError("La base no contiene proyectos.");
    } catch (caughtError) {
      setDiscoveryState("error");
      setError(caughtError instanceof Error ? caughtError.message : "No se pudieron leer los proyectos de la base .db.");
    }
  }

  async function createPreview() {
    if (!projectId) {
      setPreviewState("error");
      setError("Selecciona un proyecto para previsualizar.");
      return;
    }
    if (sourceMode === "upload" && !file) {
      setPreviewState("error");
      setError("Selecciona un archivo .db.");
      return;
    }
    if (sourceMode === "local_path" && !localPath.trim()) {
      setPreviewState("error");
      setError("Indica la ruta local del archivo .db.");
      return;
    }

    setPreviewState("loading");
    setImportResult(null);
    setError("");
    setProgress(createProgress("preview", sourceMode === "upload" ? file?.name ?? "archivo.db" : basename(localPath), "Leyendo base SQLite y preparando el draft."));

    try {
      let draft: S10ImportDraftPreview;
      if (sourceMode === "upload") {
        const uploadResult = await requestUploadSnapshot(file, projectId, subBudgetId);
        draft = uploadResult.preview;
      } else {
        const localResult = await requestJson<{ snapshot: unknown; project?: { warnings?: string[] } }>("/api/imports/db/local/export", {
          method: "POST",
          body: JSON.stringify({ path: localPath.trim(), projectId, subBudgetId: subBudgetId || undefined }),
        });
        const localDraft = await requestJson<S10ImportDraftPreview>("/api/imports/s10/draft", {
          method: "POST",
          body: JSON.stringify({ snapshot: localResult.snapshot, companyId: companyId || undefined, sourceSystem: "DB" }),
        });
        draft = {
          ...localDraft,
          warnings: [...new Set([...localDraft.warnings, ...(localResult.project?.warnings ?? [])])],
        };
      }
      setPreview(draft);
      setSelectedBudgetId(draft.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
      setItemSearch("");
      setPreviewState("success");
      setProgress(createProgress("preview", sourceMode === "upload" ? file?.name ?? "archivo.db" : basename(localPath), "La previsualizacion esta lista para revisar.", "success"));
    } catch (caughtError) {
      setPreviewState("error");
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo preparar el draft del archivo .db.");
      setProgress(createProgress("preview", sourceMode === "upload" ? file?.name ?? "archivo.db" : basename(localPath), "Revisa el error y vuelve a intentarlo.", "error"));
    }
  }

  async function importToMyc() {
    if (!projectId || !companyId) {
      setImportState("error");
      setError("Selecciona un proyecto y una empresa antes de importar.");
      return;
    }
    if (sourceMode === "upload" && !file) {
      setImportState("error");
      setError("Selecciona el archivo .db que se va a importar.");
      return;
    }
    if (sourceMode === "local_path" && !localPath.trim()) {
      setImportState("error");
      setError("Indica la ruta local del archivo .db que se va a importar.");
      return;
    }

    setImportState("loading");
    setError("");
    setProgress(createProgress("import", sourceMode === "upload" ? file?.name ?? "archivo.db" : basename(localPath), "Validando y creando el proyecto en MC."));

    try {
      const result = sourceMode === "upload"
        ? await requestUploadImport(file, companyId, projectId, subBudgetId)
        : await requestJson<ImportResult>("/api/imports/db/local/import", {
            method: "POST",
            body: JSON.stringify({ path: localPath.trim(), projectId, subBudgetId: subBudgetId || undefined, companyId }),
          });
      setImportResult(result);
      setImportState("success");
      setProgress(createProgress("import", sourceMode === "upload" ? file?.name ?? "archivo.db" : basename(localPath), "El proyecto fue importado correctamente.", "success"));
    } catch (caughtError) {
      setImportState("error");
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo importar el archivo .db.");
      setProgress(createProgress("import", sourceMode === "upload" ? file?.name ?? "archivo.db" : basename(localPath), "Revisa el error y vuelve a intentarlo.", "error"));
    }
  }

  function resetSource(nextMode: SourceMode) {
    setSourceMode(nextMode);
    setFile(null);
    setLocalPath("");
    setProjects([]);
    setProjectId("");
    setSubBudgetId("");
    setPreview(null);
    setImportResult(null);
    setError("");
    setProgress(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <Database className="h-4 w-4 text-sky-600" /> Archivo de presupuesto SQLite (.db)
              {sourceMode === "local_path" ? <Badge className="theme-status-warning">Solo local</Badge> : null}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-[var(--app-text-muted)]">
              Importa proyectos, partidas, recursos y APUs desde una base SQLite compatible. La base de origen se abre en solo lectura.
            </p>
          </div>
          <StatusBadge state={discoveryState} />
        </div>

        <div className="mt-5 inline-flex rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-1">
          <button type="button" className={modeClass(sourceMode === "upload")} onClick={() => resetSource("upload")}>
            <Upload className="h-4 w-4" /> Subir archivo
          </button>
          <button type="button" className={modeClass(sourceMode === "local_path")} disabled={!localToolsEnabled} onClick={() => resetSource("local_path")}>
            <Search className="h-4 w-4" /> Buscar base local
          </button>
        </div>
        {!localToolsEnabled ? <InlineMessage message="La lectura por ruta local solo esta disponible cuando MC se ejecuta en el equipo que tiene acceso a la base .db. Usa Subir archivo en una instalacion web." /> : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto]">
          {sourceMode === "upload" ? (
            <Input accept=".db,.sqlite,.sqlite3" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setProjects([]); setProjectId(""); setPreview(null); setError(""); }} />
          ) : (
            <Input value={localPath} onChange={(event) => { setLocalPath(event.target.value); setProjects([]); setProjectId(""); setPreview(null); }} placeholder="C:\\datos\\presupuesto.db o \\servidor\\obra\\presupuesto.db" />
          )}
          <select className={selectClassName} disabled={companies.length === 0} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            {companies.length === 0 ? <option value="">Sin empresas</option> : companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <Button className="gap-2" disabled={discoveryState === "loading" || (sourceMode === "upload" ? !file : !localPath.trim())} onClick={discoverProjects}>
            {discoveryState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar proyectos
          </Button>
        </div>
        {sourceMode === "local_path" ? <p className="mt-3 text-xs text-[var(--app-text-muted)]">La ruta debe ser accesible por el proceso Node que ejecuta MC. Esta opcion no abre rutas del equipo del usuario en un servidor remoto.</p> : null}
        {companies.length === 0 ? <InlineMessage message="Crea una empresa antes de importar proyectos .db." /> : null}
        {error ? <InlineMessage message={error} /> : null}
      </section>

      {projects.length > 0 ? (
        <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]"><FileSearch className="h-4 w-4 text-sky-600" /> Proyecto de origen</div>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Selecciona el proyecto y, si existe, el subpresupuesto que deseas revisar.</p>
            </div>
            <StatusBadge state={previewState} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select className={selectClassName} value={projectId} onChange={(event) => { setProjectId(event.target.value); setSubBudgetId(""); setPreview(null); }}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.itemCount} partidas)</option>)}
            </select>
            <select className={selectClassName} disabled={subBudgetOptions.length === 0} value={subBudgetId} onChange={(event) => setSubBudgetId(event.target.value)}>
              {subBudgetOptions.length === 0 ? <option value="">Todos los datos del proyecto</option> : subBudgetOptions.map((subBudget) => <option key={subBudget.id} value={subBudget.id}>{subBudget.name} ({subBudget.itemCount})</option>)}
            </select>
            <Button className="gap-2" disabled={previewState === "loading" || !companyId} onClick={createPreview}>
              {previewState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Exportar y previsualizar
            </Button>
          </div>
          {progress && progress.action === "preview" ? <ProgressPanel progress={progress} steps={previewSteps} /> : null}
        </section>
      ) : null}

      {preview ? (
        <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div><div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {preview.projectName}</div><p className="mt-1 text-sm text-[var(--app-text-muted)]">Fuente: archivo SQLite .db</p></div>
            <div className="flex flex-wrap gap-2"><Badge>{preview.resourceCount} insumos</Badge><Badge>{itemCount} partidas</Badge><ImportWarningsBadge count={preview.warnings.length} /></div>
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-3 md:flex-row md:items-center md:justify-between">
            <div><p className="text-sm font-medium text-[var(--app-text-strong)]">Crear proyecto MC</p><p className="text-sm text-[var(--app-text-muted)]">Revisa la conversion antes de guardar los datos.</p></div>
            <Button className="gap-2" disabled={importState === "loading" || !companyId} onClick={importToMyc}>{importState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Importar a MC</Button>
          </div>
          {progress && progress.action === "import" ? <ProgressPanel progress={progress} steps={importSteps} /> : null}
          {importResult ? <div className="theme-status-success mt-4 rounded-xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="theme-status-success-strong text-sm font-semibold">{importResult.projectName}</p><p className="text-sm">{importResult.budgetCount} presupuestos, {importResult.itemCount} partidas, {importResult.apuCount} APUs</p></div><div className="flex flex-wrap gap-2"><a className="theme-status-link-success inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium" href={`/projects/${importResult.projectId}`}>Proyecto <ExternalLink className="h-4 w-4" /></a><a className="theme-status-link-success inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium" href={`/budgets/${importResult.generalBudgetId}`}>Presupuesto <ExternalLink className="h-4 w-4" /></a></div></div></div> : null}
          <ImportWarningSummary warnings={preview.warnings} />
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5"><Metric label="Materiales" value={preview.resourcesByCategory.MATERIAL.toString()} /><Metric label="Mano de obra" value={preview.resourcesByCategory.LABOR.toString()} /><Metric label="Equipos" value={preview.resourcesByCategory.EQUIPMENT.toString()} /><Metric label="Herramientas" value={preview.resourcesByCategory.TOOLS.toString()} /><Metric label="Subcontratos" value={preview.resourcesByCategory.SUBCONTRACT.toString()} /></div>
          <ImportBudgetFooterPreview preview={preview} selectedBudgetId={selectedBudget?.id} />
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--app-border-soft)]"><div className="flex flex-col gap-3 border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><label className="text-xs font-medium uppercase text-[var(--app-text-muted)]" htmlFor="db-sub-budget">Subpresupuesto</label><select id="db-sub-budget" className={selectClassName} value={selectedBudget?.id ?? ""} onChange={(event) => setSelectedBudgetId(event.target.value)}>{preview.budgets.filter((budget) => budget.kind === "SUB_BUDGET").map((budget) => <option key={budget.id} value={budget.id}>{budget.name} ({budget.itemCount})</option>)}</select></div><div className="flex items-center gap-2"><div className="relative w-80 max-w-full"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-subtle)]" /><Input className="pl-9" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Buscar partida" /></div><Badge>{visibleRows.filter((row) => row.kind === "ITEM").length} de {selectedBudget?.itemCount ?? 0}</Badge></div></div><div className="overflow-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-[var(--app-surface-elevated)] text-xs uppercase text-[var(--app-text-muted)]"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Partida</th><th className="px-3 py-2">Und</th><th className="px-3 py-2 text-right">Metrado</th><th className="px-3 py-2 text-right">PU</th><th className="px-3 py-2 text-right">Parcial</th><th className="px-3 py-2 text-right">APU</th></tr></thead><tbody className="divide-y divide-[var(--app-border-soft)]">{visibleRows.map((row) => <PreviewRow key={`${row.kind}-${row.code}-${row.description}`} row={row} />)}</tbody></table></div></div>
        </section>
      ) : null}
    </div>
  );
}

type ProgressState = { action: "preview" | "import"; status: "running" | "success" | "error"; title: string; detail: string; progress: number; activeStepIndex: number; fileName: string };
function createProgress(action: ProgressState["action"], fileName: string, detail: string, status: ProgressState["status"] = "running"): ProgressState { return { action, status, title: action === "preview" ? "Preparando previsualizacion .db" : "Importando archivo .db", detail, progress: status === "success" ? 100 : status === "error" ? 0 : 35, activeStepIndex: status === "success" ? 3 : status === "error" ? 0 : 1, fileName }; }
function ProgressPanel({ progress, steps }: { progress: ProgressState; steps: ImportProgressPanelStep[] }) { return <ImportProgressPanel activeStepIndex={progress.activeStepIndex} detail={progress.detail} fileName={progress.fileName} progress={progress.progress} status={progress.status} steps={steps} title={progress.title} />; }
function StatusBadge({ state }: { state: RequestState }) { return <Badge className={state === "loading" ? "theme-status-info" : state === "success" ? "theme-status-success" : state === "error" ? "theme-status-error" : ""}>{state === "loading" ? "Procesando" : state === "success" ? "Listo" : state === "error" ? "Error" : "Pendiente"}</Badge>; }
function InlineMessage({ message }: { message: string }) { return <div className="theme-status-error mt-4 rounded-xl border px-3 py-2 text-sm">{message}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-3 py-2"><p className="text-xs font-medium text-[var(--app-text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p></div>; }
function PreviewRow({ row }: { row: S10ImportDraftPreviewRow }) { if (row.kind === "LEVEL") return <tr className="bg-[var(--app-surface-elevated)] text-[var(--app-text-strong)]"><td className="px-3 py-2 font-semibold">{row.code}</td><td className="px-3 py-2 font-semibold" colSpan={6}>{row.description}</td></tr>; return <tr className="text-[var(--app-text-muted)]"><td className="whitespace-nowrap px-3 py-2 font-medium text-[var(--app-text-strong)]">{row.code}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2">{row.unit}</td><td className="px-3 py-2 text-right">{formatNumber(row.quantity)}</td><td className="px-3 py-2 text-right">{formatMoney(row.unitPrice)}</td><td className="px-3 py-2 text-right">{formatMoney(row.partial)}</td><td className="px-3 py-2 text-right">{row.apuStatus === "OK" ? <span className="text-emerald-700">OK ({row.apuResourceCount})</span> : <span className="text-amber-700">{row.apuStatus === "PRICE_MISMATCH" ? "No cuadra" : "Sin APU"}</span>}</td></tr>; }
function filterRows(rows: S10ImportDraftPreviewRow[], search: string) { const normalized = normalizeSearch(search); if (!normalized) return rows; return rows.filter((row) => normalizeSearch(`${row.code} ${row.description} ${row.kind === "ITEM" ? `${row.unit} ${row.levelCode ?? ""}` : ""}`).includes(normalized)); }
function normalizeSearch(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
function formatNumber(value: number) { return value.toLocaleString("es-PE", { maximumFractionDigits: 4, minimumFractionDigits: 0 }); }
function formatMoney(value: number) { return value.toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }); }
function modeClass(active: boolean) { return `inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${active ? "bg-[var(--app-surface)] text-[var(--app-text-strong)] shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"}`; }
const selectClassName = "h-10 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500 disabled:bg-[var(--app-surface-elevated)] disabled:text-[var(--app-text-subtle)]";
function basename(value: string) { return value.split(/[\\/]/).filter(Boolean).pop() ?? "presupuesto.db"; }

async function requestUploadDiscovery(file: File | null) { if (!file) throw new Error("Selecciona un archivo .db."); const form = new FormData(); form.set("file", file); return requestForm<{ projects: DbProjectSummary[] }>("/api/imports/db/draft", form); }
async function requestUploadSnapshot(file: File | null, projectId: string, subBudgetId: string) {
  if (!file) throw new Error("Selecciona un archivo .db.");
  const form = new FormData();
  form.set("file", file);
  form.set("projectId", projectId);
  if (subBudgetId) form.set("subBudgetId", subBudgetId);
  return requestForm<{ snapshot: unknown; preview: S10ImportDraftPreview }>("/api/imports/db/draft", form);
}
async function requestUploadImport(file: File | null, companyId: string, projectId: string, subBudgetId: string) { if (!file) throw new Error("Selecciona un archivo .db."); const form = new FormData(); form.set("file", file); form.set("companyId", companyId); form.set("projectId", projectId); if (subBudgetId) form.set("subBudgetId", subBudgetId); return requestForm<ImportResult>("/api/imports/db/import", form); }
async function requestForm<T>(endpoint: string, body: FormData): Promise<T> { const response = await fetch(endpoint, { method: "POST", body }); return readResponse<T>(response); }
async function requestJson<T>(endpoint: string, init: RequestInit = {}): Promise<T> { const response = await fetch(endpoint, { headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, ...init }); return readResponse<T>(response); }
async function readResponse<T>(response: Response): Promise<T> { const body: unknown = await response.json().catch(() => null); if (!response.ok) throw new Error(readError(body)); return body as T; }
function readError(body: unknown) { return typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "No se pudo completar la operacion."; }
