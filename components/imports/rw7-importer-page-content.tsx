"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, Database, ExternalLink, FileSpreadsheet, Loader2, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportBudgetFooterPreview } from "@/components/imports/import-budget-footer-preview";
import { ImportProgressPanel, type ImportProgressPanelStep } from "@/components/imports/import-progress-panel";
import { ImportWarningSummary, ImportWarningsBadge } from "@/components/imports/import-warning-summary";
import type { S10ImportDraftPreview } from "@/lib/s10/import-preview";

type RequestState = "idle" | "loading" | "success" | "error";

type CompanyOption = {
  id: string;
  name: string;
};

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

type ImportProgressAction = "preview" | "import";

type ImportProgressState = {
  action: ImportProgressAction;
  status: "running" | "success" | "error";
  title: string;
  detail: string;
  progress: number;
  activeStepIndex: number;
  fileName: string;
  fileSize: number;
};

type Rw7ImporterCopy = {
  accept: string;
  draftEndpoint: string;
  importEndpoint: string;
  fileLabel: string;
  missingFileMessage: string;
  noCompaniesMessage: string;
  projectLabel: string;
  sourceCodeLabel: string;
  uploadDescription: string;
};

type Rw7ImporterPageContentProps = {
  companies: CompanyOption[];
  copy?: Rw7ImporterCopy;
};

const defaultCopy: Rw7ImporterCopy = {
  accept: ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  draftEndpoint: "/api/imports/rw7/draft",
  importEndpoint: "/api/imports/rw7/import",
  fileLabel: "Excel RW7",
  missingFileMessage: "Selecciona el Excel exportado desde RW7.",
  noCompaniesMessage: "Crea una empresa antes de importar proyectos RW7.",
  projectLabel: "RW7",
  sourceCodeLabel: "Presupuesto RW7",
  uploadDescription: "Lee hojas Pto, ApuB, InsB y Datos para generar el draft MYC.",
};

const previewProgressSteps: ImportProgressPanelStep[] = [
  { label: "Preparando" },
  { label: "Subiendo" },
  { label: "Analizando" },
  { label: "Previsualizando" },
];

const importProgressSteps: ImportProgressPanelStep[] = [
  { label: "Preparando" },
  { label: "Subiendo" },
  { label: "Creando proyecto" },
  { label: "Guardando APUs" },
];

export function Rw7ImporterPageContent({ companies, copy = defaultCopy }: Rw7ImporterPageContentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [draftState, setDraftState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [draftPreview, setDraftPreview] = useState<S10ImportDraftPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [draftError, setDraftError] = useState("");
  const [importError, setImportError] = useState("");
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [progressState, setProgressState] = useState<ImportProgressState | null>(null);
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
    if (subBudgetOptions.length === 0) {
      return null;
    }

    return subBudgetOptions.find((budget) => budget.id === selectedBudgetId) ?? subBudgetOptions[0] ?? null;
  }, [selectedBudgetId, subBudgetOptions]);
  const visibleItems = useMemo(() => {
    const rows = selectedBudget?.rows ?? [];
    const normalizedSearch = normalizeSearchText(itemSearch);
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      normalizeSearchText(
        row.kind === "ITEM" ? `${row.code} ${row.description} ${row.unit} ${row.levelCode ?? ""}` : `${row.code} ${row.description}`,
      ).includes(normalizedSearch),
    );
  }, [itemSearch, selectedBudget]);

  async function previewRw7File() {
    if (!file) {
      setDraftError(copy.missingFileMessage);
      setDraftState("error");
      return;
    }

    setDraftState("loading");
    setDraftError("");
    setImportError("");
    setImportResult(null);
    setProgressState(createInitialProgress("preview", file, copy.projectLabel));

    const formData = new FormData();
    formData.set("file", file);
    if (companyId) {
      formData.set("companyId", companyId);
    }

    let stopEstimate: (() => void) | null = null;

    try {
      const nextPreview = await postFormDataJson<S10ImportDraftPreview>(copy.draftEndpoint, formData, {
        onUploadProgress: (uploadProgress) => {
          setProgressState(createUploadProgress("preview", file, copy.projectLabel, uploadProgress));
        },
        onProcessing: () => {
          setProgressState(createProcessingProgress("preview", file, copy.projectLabel));
          stopEstimate = startEstimatedProgress(setProgressState, "preview");
        },
      });

      stopProgressEstimate(stopEstimate);
      setDraftPreview(nextPreview);
      setSelectedBudgetId(nextPreview.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
      setItemSearch("");
      setDraftState("success");
      setImportState("idle");
      setProgressState(createSuccessProgress("preview", file, copy.projectLabel));
    } catch (error) {
      stopProgressEstimate(stopEstimate);
      setDraftState("error");
      setDraftError(error instanceof Error ? error.message : "No se pudo completar la previsualizacion.");
      setProgressState(createErrorProgress("preview", file, copy.projectLabel));
    }
  }

  async function importRw7File() {
    if (!file) {
      setImportError(copy.missingFileMessage);
      setImportState("error");
      return;
    }

    if (!companyId) {
      setImportError("Selecciona una empresa para importar el proyecto.");
      setImportState("error");
      return;
    }

    setImportState("loading");
    setImportError("");
    setImportResult(null);
    setProgressState(createInitialProgress("import", file, copy.projectLabel));

    const formData = new FormData();
    formData.set("file", file);
    formData.set("companyId", companyId);

    let stopEstimate: (() => void) | null = null;

    try {
      const result = await postFormDataJson<ImportResult>(copy.importEndpoint, formData, {
        onUploadProgress: (uploadProgress) => {
          setProgressState(createUploadProgress("import", file, copy.projectLabel, uploadProgress));
        },
        onProcessing: () => {
          setProgressState(createProcessingProgress("import", file, copy.projectLabel));
          stopEstimate = startEstimatedProgress(setProgressState, "import");
        },
      });

      stopProgressEstimate(stopEstimate);
      setImportResult(result);
      setImportState("success");
      setProgressState(createSuccessProgress("import", file, copy.projectLabel));
    } catch (error) {
      stopProgressEstimate(stopEstimate);
      setImportState("error");
      setImportError(error instanceof Error ? error.message : "No se pudo completar la importacion.");
      setProgressState(createErrorProgress("import", file, copy.projectLabel));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileSpreadsheet className="h-4 w-4 text-sky-600" />
              {copy.fileLabel}
            </div>
            <p className="text-sm text-slate-500">{copy.uploadDescription}</p>
          </div>
          <StatusBadge state={draftState} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto]">
          <Input
            accept={copy.accept}
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setDraftPreview(null);
              setImportResult(null);
              setDraftError("");
              setImportError("");
              setProgressState(null);
            }}
          />
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
            disabled={companies.length === 0}
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setImportResult(null);
              setImportError("");
            }}
          >
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
          <Button className="gap-2" disabled={draftState === "loading"} onClick={previewRw7File}>
            {draftState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Previsualizar
          </Button>
        </div>

        {draftError ? <InlineMessage tone="error" message={draftError} /> : null}
        {companies.length === 0 ? <InlineMessage tone="error" message={copy.noCompaniesMessage} /> : null}
        {progressState && progressState.action === "preview" ? (
          <ImportProgressPanel
            activeStepIndex={progressState.activeStepIndex}
            detail={progressState.detail}
            fileName={progressState.fileName}
            fileSize={progressState.fileSize}
            progress={progressState.progress}
            status={progressState.status}
            steps={previewProgressSteps}
            title={progressState.title}
          />
        ) : null}
      </section>

      {draftPreview ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {draftPreview.projectName}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {copy.sourceCodeLabel} {draftPreview.sourceBudgetCode}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{draftPreview.resourceCount} insumos</Badge>
              <Badge>{totalItems} partidas</Badge>
              <ImportWarningsBadge count={warningCount} />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Crear proyecto MYC</p>
              <p className="text-sm text-slate-500">Importa este archivo como un proyecto nuevo con presupuesto, APUs e insumos {copy.projectLabel}.</p>
            </div>
            <Button className="gap-2" disabled={importState === "loading" || !file || !companyId} onClick={importRw7File}>
              {importState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Importar a MYC
            </Button>
          </div>

          <ImportWarningSummary warnings={draftPreview.warnings} />

          {importError ? <InlineMessage tone="error" message={importError} /> : null}
          {progressState && progressState.action === "import" ? (
            <ImportProgressPanel
              activeStepIndex={progressState.activeStepIndex}
              detail={progressState.detail}
              fileName={progressState.fileName}
              fileSize={progressState.fileSize}
              progress={progressState.progress}
              status={progressState.status}
              steps={importProgressSteps}
              title={progressState.title}
            />
          ) : null}
          {importResult ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{importResult.projectName}</p>
                  <p className="text-sm text-emerald-700">
                    1 presupuesto general, {formatCount(importResult.subBudgetIds.length, "subpresupuesto", "subpresupuestos")},{" "}
                    {formatCount(importResult.itemCount, "partida", "partidas")}, {importResult.apuCount} APUs
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                    href={`/projects/${importResult.projectId}`}
                  >
                    Proyecto
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                    href={`/budgets/${importResult.generalBudgetId}`}
                  >
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

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-xs font-medium uppercase text-slate-500" htmlFor="rw7-sub-budget-select">
                  Subpresupuesto
                </label>
                <select
                  id="rw7-sub-budget-select"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                  value={selectedBudget?.id ?? ""}
                  onChange={(event) => setSelectedBudgetId(event.target.value)}
                >
                  {subBudgetOptions.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.name} ({budget.itemCount})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Buscar partida" />
                </div>
                <Badge>
                  {visibleItems.filter((row) => row.kind === "ITEM").length} de {selectedBudget?.itemCount ?? 0}
                </Badge>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
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
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleItems.map((row) =>
                    row.kind === "LEVEL" ? (
                      <tr key={`${row.budgetName}-${row.kind}-${row.code}-${row.description}`} className="bg-slate-50 text-slate-900">
                        <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.code}</td>
                        <td className={`px-3 py-2 font-semibold ${levelIndentClassName(row.depth)}`} colSpan={7}>
                          {row.description}
                        </td>
                      </tr>
                    ) : (
                      <tr key={`${row.budgetName}-${row.code}-${row.description}`} className="text-slate-700">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{row.code}</td>
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
                            <span className="text-amber-700">
                              PU APU {formatMoney(row.calculatedApuUnitPrice ?? 0)} / dif. {formatMoney(row.unitPriceDifference ?? 0)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
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
  if (state === "loading") {
    return <Badge className="bg-sky-50 text-sky-700">Procesando</Badge>;
  }

  if (state === "success") {
    return <Badge className="bg-emerald-50 text-emerald-700">Listo</Badge>;
  }

  if (state === "error") {
    return <Badge className="bg-rose-50 text-rose-700">Error</Badge>;
  }

  return <Badge>Pendiente</Badge>;
}

function ApuStatusBadge({ item }: { item: S10ImportDraftPreview["sampleItems"][number] }) {
  if (item.apuStatus === "OK") {
    return <span className="text-emerald-700">OK ({item.apuResourceCount})</span>;
  }

  if (item.apuStatus === "PRICE_MISMATCH") {
    return <span className="text-amber-700">APU no cuadra</span>;
  }

  return <span className="text-slate-500">Sin APU</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function levelIndentClassName(depth: number) {
  if (depth <= 1) return "";
  if (depth === 2) return "pl-6";
  if (depth === 3) return "pl-9";
  return "pl-12";
}

function InlineMessage({ message, tone }: { message: string; tone: "error" }) {
  const className = tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700";

  return <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${className}`}>{message}</div>;
}

function formatNumber(value: number) {
  return value.toLocaleString("es-PE", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("es-PE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
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

function createInitialProgress(action: ImportProgressAction, file: File, sourceLabel: string): ImportProgressState {
  return {
    action,
    status: "running",
    title: action === "preview" ? `Preparando previsualizacion ${sourceLabel}` : `Preparando importacion ${sourceLabel}`,
    detail: "Validando archivo y datos de empresa.",
    progress: 5,
    activeStepIndex: 0,
    fileName: file.name,
    fileSize: file.size,
  };
}

function createUploadProgress(action: ImportProgressAction, file: File, sourceLabel: string, uploadProgress: number): ImportProgressState {
  const progress = 10 + uploadProgress * 35;

  return {
    action,
    status: "running",
    title: action === "preview" ? `Subiendo archivo ${sourceLabel}` : `Subiendo archivo ${sourceLabel}`,
    detail: `Transferencia del archivo al servidor: ${Math.round(uploadProgress * 100)}%.`,
    progress,
    activeStepIndex: 1,
    fileName: file.name,
    fileSize: file.size,
  };
}

function createProcessingProgress(action: ImportProgressAction, file: File, sourceLabel: string): ImportProgressState {
  return {
    action,
    status: "running",
    title: action === "preview" ? `Analizando estructura ${sourceLabel}` : `Importando proyecto ${sourceLabel}`,
    detail:
      action === "preview"
        ? "Leyendo presupuestos, titulos, subtitulos, partidas e insumos para armar la previsualizacion."
        : "Creando proyecto, presupuestos, partidas, APUs e insumos en MYC.",
    progress: action === "preview" ? 58 : 55,
    activeStepIndex: 2,
    fileName: file.name,
    fileSize: file.size,
  };
}

function createSuccessProgress(action: ImportProgressAction, file: File, sourceLabel: string): ImportProgressState {
  return {
    action,
    status: "success",
    title: action === "preview" ? `Previsualizacion ${sourceLabel} lista` : `Importacion ${sourceLabel} completada`,
    detail:
      action === "preview"
        ? "Ya puedes revisar la estructura antes de crear el proyecto."
        : "El proyecto, sus presupuestos, partidas, APUs e insumos fueron creados correctamente.",
    progress: 100,
    activeStepIndex: action === "preview" ? previewProgressSteps.length - 1 : importProgressSteps.length - 1,
    fileName: file.name,
    fileSize: file.size,
  };
}

function createErrorProgress(action: ImportProgressAction, file: File, sourceLabel: string): ImportProgressState {
  return {
    action,
    status: "error",
    title: action === "preview" ? `No se pudo previsualizar ${sourceLabel}` : `No se pudo importar ${sourceLabel}`,
    detail: "Revisa el mensaje de error y vuelve a intentarlo.",
    progress: 100,
    activeStepIndex: action === "preview" ? previewProgressSteps.length - 1 : importProgressSteps.length - 1,
    fileName: file.name,
    fileSize: file.size,
  };
}

function startEstimatedProgress(
  setProgressState: Dispatch<SetStateAction<ImportProgressState | null>>,
  action: ImportProgressAction,
) {
  const maxProgress = action === "preview" ? 92 : 96;
  const intervalId = window.setInterval(() => {
    setProgressState((current) => {
      if (!current || current.action !== action || current.status !== "running") {
        return current;
      }

      if (current.progress >= maxProgress) {
        return current;
      }

      const increment = current.progress < 75 ? 3 : current.progress < 88 ? 1.5 : 0.5;
      const nextProgress = Math.min(maxProgress, current.progress + increment);
      const nextActiveStepIndex =
        action === "preview"
          ? nextProgress >= 85
            ? 3
            : current.activeStepIndex
          : nextProgress >= 82
            ? 3
            : current.activeStepIndex;

      return {
        ...current,
        progress: nextProgress,
        activeStepIndex: nextActiveStepIndex,
        detail:
          action === "preview" && nextProgress >= 85
            ? "Preparando resumen, advertencias y muestra de partidas."
            : action === "import" && nextProgress >= 82
              ? "Guardando APUs e insumos; esta etapa puede tardar en archivos grandes."
              : current.detail,
      };
    });
  }, 850);

  return () => window.clearInterval(intervalId);
}

function stopProgressEstimate(stopEstimate: (() => void) | null) {
  if (stopEstimate) {
    stopEstimate();
  }
}

function postFormDataJson<T>(
  endpoint: string,
  formData: FormData,
  handlers: {
    onUploadProgress: (progress: number) => void;
    onProcessing: () => void;
  },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let processingStarted = false;

    request.open("POST", endpoint);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        return;
      }

      handlers.onUploadProgress(Math.min(1, event.loaded / event.total));
    };
    request.upload.onload = () => {
      if (!processingStarted) {
        processingStarted = true;
        handlers.onProcessing();
      }
    };
    request.onreadystatechange = () => {
      if (request.readyState === XMLHttpRequest.HEADERS_RECEIVED && !processingStarted) {
        processingStarted = true;
        handlers.onProcessing();
      }
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(readApiErrorText(request.responseText)));
        return;
      }

      try {
        resolve(JSON.parse(request.responseText) as T);
      } catch {
        reject(new Error("La respuesta de importacion no tiene un formato valido."));
      }
    };
    request.onerror = () => reject(new Error("No se pudo conectar con el servidor de importacion."));
    request.ontimeout = () => reject(new Error("La importacion tardo demasiado en responder."));
    request.send(formData);
  });
}

function readApiErrorText(responseText: string) {
  try {
    const payload: unknown = JSON.parse(responseText);
    if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    return responseText.trim() || "No se pudo completar la operacion.";
  }

  return "No se pudo completar la operacion.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
