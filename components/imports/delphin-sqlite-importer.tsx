"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Database, ExternalLink, FileJson, FileSearch, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportBudgetFooterPreview } from "@/components/imports/import-budget-footer-preview";
import { ImportProgressPanel, type ImportProgressPanelStep } from "@/components/imports/import-progress-panel";
import { ImportWarningSummary, ImportWarningsBadge } from "@/components/imports/import-warning-summary";
import type { S10ImportDraftPreview } from "@/lib/s10/import-preview";
import type { S10SnapshotContract } from "@/lib/s10/snapshot-contract";

type RequestState = "idle" | "loading" | "success" | "error";
type CompanyOption = { id: string; name: string };

type DelphinSqliteProject = {
  id: string;
  name: string;
  budgetCount: number;
};

type S10ImportResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  resourceCount: number;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
};

type DelphinProgressAction = "preview" | "import";
type DelphinProgressSource = { fileName: string; fileSize: number; label: string };
type DelphinProgressState = {
  action: DelphinProgressAction;
  status: "running" | "success" | "error";
  title: string;
  detail: string;
  progress: number;
  activeStepIndex: number;
  fileName: string;
  fileSize: number;
};

const previewProgressSteps: ImportProgressPanelStep[] = [
  { label: "Leyendo base" },
  { label: "Exportando proyecto" },
  { label: "Convirtiendo APUs" },
  { label: "Previsualizando" },
];

const importProgressSteps: ImportProgressPanelStep[] = [
  { label: "Preparando" },
  { label: "Creando proyecto" },
  { label: "Guardando APUs" },
];

export function DelphinSqliteImporter({ companies }: { companies: CompanyOption[] }) {
  const [sqlitePath, setSqlitePath] = useState("");
  const [projectState, setProjectState] = useState<RequestState>("idle");
  const [exportState, setExportState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [projects, setProjects] = useState<DelphinSqliteProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projectError, setProjectError] = useState("");
  const [exportError, setExportError] = useState("");
  const [importError, setImportError] = useState("");
  const [localSnapshot, setLocalSnapshot] = useState<S10SnapshotContract | null>(null);
  const [draftPreview, setDraftPreview] = useState<S10ImportDraftPreview | null>(null);
  const [importResult, setImportResult] = useState<S10ImportResult | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [progressState, setProgressState] = useState<DelphinProgressState | null>(null);
  const hasPreview = draftPreview != null;
  const warningCount = draftPreview?.warnings.length ?? 0;
  const totalItems = useMemo(
    () => draftPreview?.budgets.filter((budget) => budget.kind === "SUB_BUDGET").reduce((sum, budget) => sum + budget.itemCount, 0) ?? 0,
    [draftPreview],
  );
  const subBudgetOptions = useMemo(
    () => draftPreview?.budgets.filter((budget) => budget.kind === "SUB_BUDGET") ?? [],
    [draftPreview],
  );
  const selectedBudget = useMemo(() => {
    if (subBudgetOptions.length === 0) return null;
    return subBudgetOptions.find((budget) => budget.id === selectedBudgetId) ?? subBudgetOptions[0] ?? null;
  }, [selectedBudgetId, subBudgetOptions]);
  const visibleItems = useMemo(() => {
    const rows = selectedBudget?.rows ?? [];
    const normalizedSearch = normalizeSearchText(itemSearch);
    if (!normalizedSearch) return rows;
    return rows.filter((row) =>
      normalizeSearchText(
        row.kind === "ITEM" ? `${row.code} ${row.description} ${row.unit} ${row.levelCode ?? ""}` : `${row.code} ${row.description}`,
      ).includes(normalizedSearch),
    );
  }, [itemSearch, selectedBudget]);

  async function loadProjects() {
    if (!sqlitePath.trim()) {
      setProjectError("Indica la ruta del archivo .sqlite de Delphin.");
      setProjectState("error");
      return;
    }

    setProjectState("loading");
    setProjectError("");
    setProjects([]);
    setSelectedProjectId("");

    try {
      const params = new URLSearchParams({ path: sqlitePath.trim() });
      const response = await fetch(`/api/imports/delphin/sqlite/projects?${params.toString()}`);
      if (!response.ok) {
        const body: unknown = await response.json();
        throw new Error(readApiError(body, "No se pudieron leer los proyectos Delphin."));
      }

      const body = (await response.json()) as { projects: DelphinSqliteProject[] };
      setProjects(body.projects);
      setSelectedProjectId(body.projects[0]?.id ?? "");
      setProjectState("success");
    } catch (error) {
      setProjectState("error");
      setProjectError(error instanceof Error ? error.message : "No se pudieron leer los proyectos Delphin.");
    }
  }

  async function exportAndPreview() {
    if (!sqlitePath.trim() || !selectedProjectId) {
      setExportError("Selecciona un proyecto para exportar.");
      setExportState("error");
      return;
    }

    setExportState("loading");
    setExportError("");
    setImportResult(null);
    setImportError("");
    const progressSource = createProgressSource(sqlitePath, selectedProjectId);
    setProgressState(createInitialProgress("preview", progressSource));

    try {
      // Step 1: Export from SQLite
      setProgressState({ ...createProcessingProgress("preview", progressSource), title: "Exportando proyecto Delphin", detail: "Leyendo base SQLite y convirtiendo a snapshot MC.", progress: 30, activeStepIndex: 1 });

      const exportResponse = await fetch("/api/imports/delphin/sqlite/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: sqlitePath.trim(), projectId: selectedProjectId }),
      });
      if (!exportResponse.ok) {
        const body: unknown = await exportResponse.json();
        throw new Error(readApiError(body, "No se pudo exportar el proyecto Delphin."));
      }

      const exportBody = (await exportResponse.json()) as { snapshot: S10SnapshotContract };
      setLocalSnapshot(exportBody.snapshot);

      // Step 2: Create draft preview
      setProgressState({ ...createProcessingProgress("preview", progressSource), title: "Preparando previsualizacion", detail: "Analizando presupuestos, partidas, APUs e insumos.", progress: 70, activeStepIndex: 3 });

      const draftResponse = await fetch("/api/imports/delphin/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: exportBody.snapshot, companyId: companyId || undefined }),
      });
      if (!draftResponse.ok) {
        const body: unknown = await draftResponse.json();
        throw new Error(readApiError(body, "No se pudo preparar el draft de importacion Delphin."));
      }

      const preview = (await draftResponse.json()) as S10ImportDraftPreview;
      setDraftPreview(preview);
      setSelectedBudgetId(preview.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
      setItemSearch("");
      setExportState("success");
      setProgressState(createSuccessProgress("preview", progressSource));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la previsualizacion Delphin.";
      setExportState("error");
      setExportError(message);
      setProgressState(createErrorProgress("preview", progressSource));
    }
  }

  async function importToMyc() {
    if (!localSnapshot || !companyId) {
      setImportError("Selecciona una empresa para importar el proyecto.");
      setImportState("error");
      return;
    }

    setImportState("loading");
    setImportError("");
    const progressSource = createProgressSource(sqlitePath, selectedProjectId);
    setProgressState(createInitialProgress("import", progressSource));

    try {
      setProgressState({ ...createProcessingProgress("import", progressSource), title: "Importando a MC", detail: "Creando proyecto, presupuestos y APUs.", progress: 50, activeStepIndex: 1 });

      const response = await fetch("/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: localSnapshot, companyId }),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        throw new Error(readApiError(body, "No se pudo importar el proyecto."));
      }

      const result = (await response.json()) as S10ImportResult;
      setImportResult(result);
      setImportState("success");
      setProgressState(createSuccessProgress("import", progressSource));
    } catch (error) {
      setImportState("error");
      setImportError(error instanceof Error ? error.message : "No se pudo importar el proyecto.");
      setProgressState(createErrorProgress("import", progressSource));
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select SQLite file */}
      <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <Database className="h-4 w-4 text-sky-600" />
              Base de datos SQLite de Delphin Express
              <Badge className="theme-status-warning text-[10px] font-semibold uppercase tracking-wide">Solo local</Badge>
            </div>
            <p className="text-sm text-[var(--app-text-muted)]">
              Apunta al archivo <code className="rounded bg-slate-100 px-1 text-xs">SQLDelphin_maestro.sqlite</code> de tu instalación de Delphin Express BIM 360.
              Debes cerrar Delphin antes de importar para evitar bloqueos.
            </p>
          </div>
          <StatusBadge state={projectState} />
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <Input value={sqlitePath} onChange={(event) => setSqlitePath(event.target.value)} placeholder="C:\Program Files\Delphin Express BIM 360 r106\App64\Database\SQLDelphin_maestro.sqlite" />
          <Button className="gap-2" disabled={projectState === "loading"} onClick={loadProjects}>
            {projectState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar proyectos
          </Button>
        </div>
        {projectError ? <InlineMessage message={projectError} /> : null}
      </section>

      {/* Step 2: Select project and export */}
      {projects.length > 0 ? (
        <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                <FileJson className="h-4 w-4 text-sky-600" />
                Proyectos encontrados
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">Selecciona un proyecto y una empresa de destino para exportar y previsualizar.</p>
            </div>
            <StatusBadge state={exportState} />
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <select className="h-10 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.budgetCount} presupuestos)
                </option>
              ))}
            </select>
            <select className="h-10 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500 disabled:bg-[var(--app-surface-elevated)] disabled:text-[var(--app-text-subtle)]" disabled={companies.length === 0} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {companies.length === 0 ? (
                <option value="">Sin empresas</option>
              ) : (
                companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))
              )}
            </select>
            <Button className="gap-2" disabled={exportState === "loading" || !companyId} onClick={exportAndPreview}>
              {exportState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              Exportar y previsualizar
            </Button>
          </div>
          {exportError ? <InlineMessage message={exportError} /> : null}
          {companies.length === 0 ? <InlineMessage message="Crea una empresa antes de importar proyectos Delphin." /> : null}
          {progressState && progressState.action === "preview" ? (
            <ImportProgressPanel activeStepIndex={progressState.activeStepIndex} detail={progressState.detail} fileName={progressState.fileName} fileSize={progressState.fileSize} progress={progressState.progress} status={progressState.status} steps={previewProgressSteps} title={progressState.title} />
          ) : null}
        </section>
      ) : null}

      {/* Step 3: Draft preview + import */}
      {hasPreview ? (
        <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {draftPreview.projectName}
              </div>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Presupuesto Delphin {draftPreview.sourceBudgetCode}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{draftPreview.resourceCount} insumos</Badge>
              <Badge>{totalItems} partidas</Badge>
              <ImportWarningsBadge count={warningCount} />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--app-text-strong)]">Crear proyecto MC</p>
              <p className="text-sm text-[var(--app-text-muted)]">Importa este proyecto con presupuestos, APUs e insumos Delphin.</p>
            </div>
            <Button className="gap-2" disabled={importState === "loading" || !localSnapshot || !companyId} onClick={importToMyc}>
              {importState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Importar a MC
            </Button>
          </div>

          <ImportWarningSummary warnings={draftPreview.warnings} />

          {importError ? <InlineMessage message={importError} /> : null}
          {progressState && progressState.action === "import" ? (
            <ImportProgressPanel activeStepIndex={progressState.activeStepIndex} detail={progressState.detail} fileName={progressState.fileName} fileSize={progressState.fileSize} progress={progressState.progress} status={progressState.status} steps={importProgressSteps} title={progressState.title} />
          ) : null}
          {importResult ? (
            <div className="theme-status-success mt-4 rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="theme-status-success-strong text-sm font-semibold">{importResult.projectName}</p>
                  <p className="text-sm">
                    1 presupuesto general, {formatCount(importResult.subBudgetIds.length, "subpresupuesto", "subpresupuestos")}, {formatCount(importResult.itemCount, "partida", "partidas")}, {importResult.apuCount} APUs
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="theme-status-link-success inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70" href={`/projects/${importResult.projectId}`}>
                    Proyecto
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a className="theme-status-link-success inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70" href={`/budgets/${importResult.generalBudgetId}`}>
                    Presupuesto
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric label="Materiales" value={draftPreview.resourcesByCategory.MATERIAL.toString()} />
            <Metric label="Mano de obra" value={draftPreview.resourcesByCategory.LABOR.toString()} />
            <Metric label="Equipos" value={draftPreview.resourcesByCategory.EQUIPMENT.toString()} />
            <Metric label="Herramientas" value={draftPreview.resourcesByCategory.TOOLS.toString()} />
            <Metric label="Subcontratos" value={draftPreview.resourcesByCategory.SUBCONTRACT.toString()} />
          </div>

          <ImportBudgetFooterPreview preview={draftPreview} selectedBudgetId={selectedBudget?.id} />

          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
            <div className="flex flex-col gap-3 border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-xs font-medium uppercase text-[var(--app-text-muted)]" htmlFor="delphin-sqlite-sub-budget-select">Subpresupuesto</label>
                <select id="delphin-sqlite-sub-budget-select" className="h-10 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500" value={selectedBudget?.id ?? ""} onChange={(event) => setSelectedBudgetId(event.target.value)}>
                  {subBudgetOptions.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.name} ({budget.itemCount})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-subtle)]" />
                  <Input className="pl-9" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Buscar partida" />
                </div>
                <Badge>{visibleItems.filter((row) => row.kind === "ITEM").length} de {selectedBudget?.itemCount ?? 0}</Badge>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="sticky top-0 bg-[var(--app-surface-elevated)] text-xs uppercase text-[var(--app-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Partida</th>
                    <th className="px-3 py-2 font-medium">Und</th>
                    <th className="px-3 py-2 text-right font-medium">Metrado</th>
                    <th className="px-3 py-2 text-right font-medium">PU</th>
                    <th className="px-3 py-2 text-right font-medium">Parcial</th>
                    <th className="px-3 py-2 text-right font-medium">APU</th>
                    <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border-soft)] bg-[var(--app-surface)]">
                  {visibleItems.map((row) =>
                    row.kind === "LEVEL" ? (
                      <tr key={`${row.budgetName}-${row.kind}-${row.code}-${row.description}`} className="bg-[var(--app-surface-elevated)] text-[var(--app-text-strong)]">
                        <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.code}</td>
                        <td className={`px-3 py-2 font-semibold ${levelIndentClassName(row.depth)}`} colSpan={7}>
                          {row.description}
                        </td>
                      </tr>
                    ) : (
                      <tr key={`${row.budgetName}-${row.code}-${row.description}`} className="text-[var(--app-text-muted)]">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-[var(--app-text-strong)]">{row.code}</td>
                        <td className={`px-3 py-2 ${levelIndentClassName(row.depth)}`}>{row.description}</td>
                        <td className="whitespace-nowrap px-3 py-2">{row.unit}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatNumber(row.quantity)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(row.unitPrice)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(row.partial)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <ApuStatusBadge item={row} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.apuStatus === "PRICE_MISMATCH" ? (
                            <span className="text-amber-700">PU APU {formatMoney(row.calculatedApuUnitPrice ?? 0)} / dif. {formatMoney(row.unitPriceDifference ?? 0)}</span>
                          ) : (
                            <span className="text-[var(--app-text-subtle)]">-</span>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ state }: { state: RequestState }) {
  if (state === "loading") return <Badge className="theme-status-info">Procesando</Badge>;
  if (state === "success") return <Badge className="theme-status-success">Listo</Badge>;
  if (state === "error") return <Badge className="theme-status-error">Error</Badge>;
  return <Badge>Pendiente</Badge>;
}

function ApuStatusBadge({ item }: { item: S10ImportDraftPreview["sampleItems"][number] }) {
  if (item.apuStatus === "OK") return <span className="text-emerald-700">OK ({item.apuResourceCount})</span>;
  if (item.apuStatus === "PRICE_MISMATCH") return <span className="text-amber-700">APU no cuadra</span>;
  return <span className="text-[var(--app-text-muted)]">Sin APU</span>;
}

function levelIndentClassName(depth: number) {
  if (depth <= 1) return "";
  if (depth === 2) return "pl-6";
  if (depth === 3) return "pl-9";
  return "pl-12";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-3 py-2">
      <p className="text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function InlineMessage({ message }: { message: string }) {
  return <div className="theme-status-error mt-4 rounded-xl border px-3 py-2 text-sm">{message}</div>;
}

function formatNumber(value: number) {
  return value.toLocaleString("es-PE", { maximumFractionDigits: 4, minimumFractionDigits: 0 });
}

function formatMoney(value: number) {
  return value.toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readApiError(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return fallback;
}

function createProgressSource(path: string, projectId: string): DelphinProgressSource {
  const segments = path.split("\\").filter(Boolean);
  return {
    fileName: segments[segments.length - 1] ?? "SQLDelphin_maestro.sqlite",
    fileSize: 0,
    label: `${projectId} desde ${path}`,
  };
}

function createInitialProgress(action: DelphinProgressAction, source: DelphinProgressSource): DelphinProgressState {
  return { action, status: "running", title: "Preparando...", detail: "Iniciando proceso.", progress: 5, activeStepIndex: 0, fileName: source.fileName, fileSize: source.fileSize };
}

function createProcessingProgress(action: DelphinProgressAction, source: DelphinProgressSource): DelphinProgressState {
  return { action, status: "running", title: "Procesando...", detail: "Trabajando en los datos.", progress: 40, activeStepIndex: 2, fileName: source.fileName, fileSize: source.fileSize };
}

function createSuccessProgress(action: DelphinProgressAction, source: DelphinProgressSource): DelphinProgressState {
  return { action, status: "success", title: "Completado", detail: "Proceso finalizado exitosamente.", progress: 100, activeStepIndex: 3, fileName: source.fileName, fileSize: source.fileSize };
}

function createErrorProgress(action: DelphinProgressAction, source: DelphinProgressSource): DelphinProgressState {
  return { action, status: "error", title: "Error", detail: "Ocurrió un error durante el proceso.", progress: 0, activeStepIndex: 0, fileName: source.fileName, fileSize: source.fileSize };
}