"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  CheckCircle2,
  Database,
  ExternalLink,
  FileJson,
  FileSearch,
  Loader2,
  Search,
  Server,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportBudgetFooterPreview } from "@/components/imports/import-budget-footer-preview";
import { ImportProgressPanel, type ImportProgressPanelStep } from "@/components/imports/import-progress-panel";
import { ImportWarningSummary, ImportWarningsBadge } from "@/components/imports/import-warning-summary";
import type { S10ImportPreview } from "@/lib/s10/s2k-analyzer";
import type { S10ImportDraftPreview } from "@/lib/s10/import-preview";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

type RequestState = "idle" | "loading" | "success" | "error";
type RestoreBackupSourceMode = "path" | "upload";

type ApiErrorResponse = {
  error?: string;
};

type CompanyOption = {
  id: string;
  name: string;
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

type S10LocalDatabase = {
  databaseName: string;
  isS10Candidate: boolean;
  matchedTables: string[];
  presupuestoCount: number;
};

type S10LocalBudget = {
  code: string;
  description: string;
  totalCost: number | null;
  subBudgetCount: number;
  itemCount: number;
};

type S10LocalRestoreResult = {
  backupPath: string;
  database: S10LocalDatabase;
  files: Array<{
    logicalName: string;
    type: "data" | "log";
    targetPath: string;
  }>;
};

type S10ImporterPageContentProps = {
  companies: CompanyOption[];
};

type S10ProgressAction = "preview" | "import" | "restore";

type S10ProgressState = {
  action: S10ProgressAction;
  status: "running" | "success" | "error";
  title: string;
  detail: string;
  progress: number;
  activeStepIndex: number;
  fileName: string;
  fileSize: number;
};

type S10ProgressSource = {
  fileName: string;
  fileSize: number;
  label: string;
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

const restoreProgressSteps: ImportProgressPanelStep[] = [
  { label: "Preparando" },
  { label: "Subiendo" },
  { label: "Restaurando" },
  { label: "Verificando" },
];

export function S10ImporterPageContent({ companies }: S10ImporterPageContentProps) {
  const [s2kFile, setS2kFile] = useState<File | null>(null);
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [budgetCode, setBudgetCode] = useState("0201003");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [analysisState, setAnalysisState] = useState<RequestState>("idle");
  const [localRestoreState, setLocalRestoreState] = useState<RequestState>("idle");
  const [localSqlState, setLocalSqlState] = useState<RequestState>("idle");
  const [localBudgetState, setLocalBudgetState] = useState<RequestState>("idle");
  const [localExportState, setLocalExportState] = useState<RequestState>("idle");
  const [draftState, setDraftState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [analysis, setAnalysis] = useState<S10ImportPreview | null>(null);
  const [localServer, setLocalServer] = useState("np:\\\\.\\pipe\\SQLLocal\\SQLEXPRESS");
  const [localUser, setLocalUser] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [restoreBackupSourceMode, setRestoreBackupSourceMode] = useState<RestoreBackupSourceMode>("upload");
  const [localBackupPath, setLocalBackupPath] = useState("presupuesto-ejemplo\\s10\\obra.S2K");
  const [localRestoreFile, setLocalRestoreFile] = useState<File | null>(null);
  const [restoreDatabaseName, setRestoreDatabaseName] = useState("S10_OBRA_MYC");
  const [replaceExistingDatabase, setReplaceExistingDatabase] = useState(false);
  const [localDatabase, setLocalDatabase] = useState("");
  const [localDatabases, setLocalDatabases] = useState<S10LocalDatabase[]>([]);
  const [localBudgets, setLocalBudgets] = useState<S10LocalBudget[]>([]);
  const [localRestoreResult, setLocalRestoreResult] = useState<S10LocalRestoreResult | null>(null);
  const [localSnapshot, setLocalSnapshot] = useState<S10ExportSnapshot | null>(null);
  const [draftPreview, setDraftPreview] = useState<S10ImportDraftPreview | null>(null);
  const [importResult, setImportResult] = useState<S10ImportResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [localRestoreError, setLocalRestoreError] = useState("");
  const [localSqlError, setLocalSqlError] = useState("");
  const [localBudgetError, setLocalBudgetError] = useState("");
  const [localExportError, setLocalExportError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [importError, setImportError] = useState("");
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [progressState, setProgressState] = useState<S10ProgressState | null>(null);
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
    if (subBudgetOptions.length === 0) {
      return null;
    }

    return subBudgetOptions.find((budget) => budget.id === selectedBudgetId) ?? subBudgetOptions[0] ?? null;
  }, [selectedBudgetId, subBudgetOptions]);
  const visibleItems = useMemo(() => {
    const items = selectedBudget?.items ?? [];
    const normalizedSearch = normalizeSearchText(itemSearch);
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) =>
      normalizeSearchText(`${item.code} ${item.description} ${item.unit}`).includes(normalizedSearch),
    );
  }, [itemSearch, selectedBudget]);

  async function analyzeS2kFile() {
    if (!s2kFile) {
      setAnalysisError("Selecciona un archivo .s2k.");
      setAnalysisState("error");
      return;
    }

    setAnalysisState("loading");
    setAnalysisError("");

    const formData = new FormData();
    formData.set("file", s2kFile);

    const response = await fetch("/api/imports/s10/analyze", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      setAnalysisState("error");
      setAnalysisError(await readApiError(response));
      return;
    }

    setAnalysis((await response.json()) as S10ImportPreview);
    setAnalysisState("success");
  }

  async function previewSnapshotDraft() {
    if (!snapshotFile) {
      setDraftError("Selecciona el snapshot JSON exportado desde S10.");
      setDraftState("error");
      return;
    }

    setDraftState("loading");
    setDraftError("");
    setImportError("");
    setImportResult(null);
    const progressSource = createFileProgressSource(snapshotFile, "Snapshot S10");
    setProgressState(createInitialProgress("preview", progressSource));

    const formData = new FormData();
    formData.set("file", snapshotFile);
    if (budgetCode.trim()) {
      formData.set("budgetCode", budgetCode.trim());
    }
    if (companyId) {
      formData.set("companyId", companyId);
    }

    let stopEstimate: (() => void) | null = null;

    try {
      const nextPreview = await postFormDataJson<S10ImportDraftPreview>("/api/imports/s10/draft", formData, {
        onUploadProgress: (uploadProgress) => {
          setProgressState(createUploadProgress("preview", progressSource, uploadProgress));
        },
        onProcessing: () => {
          setProgressState(createProcessingProgress("preview", progressSource));
          stopEstimate = startEstimatedProgress(setProgressState, "preview");
        },
      });

      stopProgressEstimate(stopEstimate);
      setLocalSnapshot(null);
      setDraftPreview(nextPreview);
      setSelectedBudgetId(nextPreview.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
      setItemSearch("");
      setDraftState("success");
      setImportState("idle");
      setImportError("");
      setImportResult(null);
      setProgressState(createSuccessProgress("preview", progressSource));
    } catch (error) {
      stopProgressEstimate(stopEstimate);
      setDraftState("error");
      setDraftError(error instanceof Error ? error.message : "No se pudo completar la previsualizacion S10.");
      setProgressState(createErrorProgress("preview", progressSource));
    }
  }

  async function importSnapshotToMyc() {
    if (!snapshotFile && !localSnapshot) {
      setImportError("Selecciona el snapshot JSON exportado desde S10.");
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
    const progressSource =
      localSnapshot && !snapshotFile
        ? createLocalSnapshotProgressSource(localDatabase, budgetCode)
        : snapshotFile
          ? createFileProgressSource(snapshotFile, "Snapshot S10")
          : null;

    if (!progressSource) {
      setImportError("Selecciona el snapshot JSON exportado desde S10.");
      setImportState("error");
      return;
    }

    setProgressState(createInitialProgress("import", progressSource));

    let stopEstimate: (() => void) | null = null;

    try {
      const result =
        localSnapshot && !snapshotFile
          ? await postJsonWithEstimatedProgress<S10ImportResult>(
              "/api/imports/s10/import",
              {
                snapshot: localSnapshot,
                companyId,
                budgetCode: budgetCode.trim() || undefined,
              },
              {
                onProcessing: () => {
                  setProgressState(createProcessingProgress("import", progressSource));
                  stopEstimate = startEstimatedProgress(setProgressState, "import");
                },
              },
            )
          : await importSnapshotFileToMyc(
              progressSource,
              (uploadProgress) => {
                setProgressState(createUploadProgress("import", progressSource, uploadProgress));
              },
              () => {
              setProgressState(createProcessingProgress("import", progressSource));
              stopEstimate = startEstimatedProgress(setProgressState, "import");
              },
            );

      stopProgressEstimate(stopEstimate);
      setImportResult(result);
      setImportState("success");
      setProgressState(createSuccessProgress("import", progressSource));
    } catch (error) {
      stopProgressEstimate(stopEstimate);
      setImportState("error");
      setImportError(error instanceof Error ? error.message : "No se pudo completar la importacion S10.");
      setProgressState(createErrorProgress("import", progressSource));
    }
  }

  async function importSnapshotFileToMyc(
    progressSource: S10ProgressSource,
    onUploadProgress: (progress: number) => void,
    onProcessing: () => void,
  ) {
    if (!snapshotFile) {
      throw new Error("Selecciona el snapshot JSON exportado desde S10.");
    }

    const formData = new FormData();
    formData.set("file", snapshotFile);
    formData.set("companyId", companyId);
    if (budgetCode.trim()) {
      formData.set("budgetCode", budgetCode.trim());
    }

    return postFormDataJson<S10ImportResult>("/api/imports/s10/import", formData, {
      onUploadProgress,
      onProcessing: () => {
        setProgressState(createProcessingProgress("import", progressSource));
        onProcessing();
      },
    });
  }

  async function loadLocalDatabases() {
    setLocalSqlState("loading");
    setLocalSqlError("");
    setLocalDatabases([]);
    setLocalBudgets([]);
    setLocalDatabase("");

    const params = createLocalSqlServerParams(localServer, localUser, localPassword);
    const response = await fetch(`/api/imports/s10/sqlserver/databases?${params.toString()}`);

    if (!response.ok) {
      setLocalSqlState("error");
      setLocalSqlError(await readApiError(response));
      return;
    }

    const body = (await response.json()) as { databases: S10LocalDatabase[] };
    setLocalDatabases(body.databases);
    setLocalDatabase(body.databases[0]?.databaseName ?? "");
    setLocalSqlState("success");
  }

  async function restoreLocalS2kBackup() {
    if (restoreBackupSourceMode === "path" && !localBackupPath.trim()) {
      setLocalRestoreError("Indica la ruta local del archivo .S2K.");
      setLocalRestoreState("error");
      return;
    }

    if (restoreBackupSourceMode === "upload" && !localRestoreFile) {
      setLocalRestoreError("Selecciona un archivo .S2K.");
      setLocalRestoreState("error");
      return;
    }

    if (!restoreDatabaseName.trim()) {
      setLocalRestoreError("Indica el nombre de la base destino.");
      setLocalRestoreState("error");
      return;
    }

    setLocalRestoreState("loading");
    setLocalRestoreError("");
    setLocalRestoreResult(null);
    setLocalBudgets([]);
    setLocalBudgetError("");
    setLocalExportError("");
    const progressSource =
      restoreBackupSourceMode === "upload" && localRestoreFile
        ? createFileProgressSource(localRestoreFile, "respaldo S10")
        : createRestoreBackupPathProgressSource(localBackupPath);
    setProgressState(createInitialProgress("restore", progressSource));
    let stopEstimate: (() => void) | null = null;

    try {
      const result = restoreBackupSourceMode === "upload" && localRestoreFile
        ? await restoreUploadedS2kBackup(
            localRestoreFile,
            (uploadProgress) => setProgressState(createUploadProgress("restore", progressSource, uploadProgress)),
            () => {
              setProgressState(createProcessingProgress("restore", progressSource));
              stopEstimate = startEstimatedProgress(setProgressState, "restore");
            },
          )
        : await postJsonWithEstimatedProgress<S10LocalRestoreResult>(
            "/api/imports/s10/sqlserver/restore",
            {
              server: localServer.trim() || ".\\SQLEXPRESS",
              backupPath: localBackupPath.trim(),
              databaseName: restoreDatabaseName.trim(),
              replaceExisting: replaceExistingDatabase,
              user: localUser.trim() || undefined,
              password: localPassword.trim() || undefined,
            },
            {
              onProcessing: () => {
                setProgressState(createProcessingProgress("restore", progressSource));
                stopEstimate = startEstimatedProgress(setProgressState, "restore");
              },
            },
          );

      stopProgressEstimate(stopEstimate);
      setLocalRestoreResult(result);
      setLocalDatabases((current) => upsertLocalDatabase(current, result.database));
      setLocalDatabase(result.database.databaseName);
      setLocalRestoreState("success");
      setLocalSqlState("success");
      setLocalBudgetState("idle");
      setProgressState(createSuccessProgress("restore", progressSource));
    } catch (error) {
      stopProgressEstimate(stopEstimate);
      setLocalRestoreState("error");
      setLocalRestoreError(error instanceof Error ? error.message : "No se pudo restaurar el backup S10 local.");
      setProgressState(createErrorProgress("restore", progressSource));
    }
  }

  async function restoreUploadedS2kBackup(
    file: File,
    onUploadProgress: (progress: number) => void,
    onProcessing: () => void,
  ) {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("server", localServer.trim() || ".\\SQLEXPRESS");
    formData.set("databaseName", restoreDatabaseName.trim());
    formData.set("replaceExisting", replaceExistingDatabase ? "true" : "false");
    if (localUser.trim()) {
      formData.set("user", localUser.trim());
    }
    if (localPassword.trim()) {
      formData.set("password", localPassword.trim());
    }

    return postFormDataJson<S10LocalRestoreResult>("/api/imports/s10/sqlserver/restore", formData, {
      onUploadProgress,
      onProcessing,
    });
  }

  async function loadLocalBudgets(databaseName = localDatabase) {
    if (!databaseName) {
      setLocalBudgetError("Selecciona una base S10.");
      setLocalBudgetState("error");
      return;
    }

    setLocalBudgetState("loading");
    setLocalBudgetError("");
    setLocalBudgets([]);

    const params = createLocalSqlServerParams(localServer, localUser, localPassword);
    params.set("database", databaseName);
    const response = await fetch(`/api/imports/s10/sqlserver/budgets?${params.toString()}`);

    if (!response.ok) {
      setLocalBudgetState("error");
      setLocalBudgetError(await readApiError(response));
      return;
    }

    const body = (await response.json()) as { budgets: S10LocalBudget[] };
    setLocalBudgets(body.budgets);
    setBudgetCode(body.budgets.find((budget) => budget.code.length > 0)?.code ?? budgetCode);
    setLocalBudgetState("success");
  }

  async function previewFromLocalSqlServer() {
    if (!localDatabase) {
      setLocalExportError("Selecciona una base S10.");
      setLocalExportState("error");
      return;
    }

    if (!budgetCode.trim()) {
      setLocalExportError("Selecciona o escribe un codigo de presupuesto.");
      setLocalExportState("error");
      return;
    }

    setLocalExportState("loading");
    setLocalExportError("");
    setDraftState("loading");
    setDraftError("");
    setImportResult(null);
    setImportError("");
    const progressSource = createLocalSnapshotProgressSource(localDatabase, budgetCode);
    setProgressState(createInitialProgress("preview", progressSource));
    let stopEstimate: (() => void) | null = startEstimatedProgress(setProgressState, "preview");

    try {
      const exportBody = await postJsonWithEstimatedProgress<{ snapshot: S10ExportSnapshot }>(
        "/api/imports/s10/sqlserver/export",
        {
          server: localServer.trim() || ".\\SQLEXPRESS",
          databaseName: localDatabase,
          budgetCode: budgetCode.trim(),
          user: localUser.trim() || undefined,
          password: localPassword.trim() || undefined,
        },
        {
          onProcessing: () => {
            setProgressState({
              ...createProcessingProgress("preview", progressSource),
              title: "Exportando snapshot S10 local",
              detail: "Leyendo SQL Server local y convirtiendo el presupuesto seleccionado a snapshot MYC.",
              progress: 35,
              activeStepIndex: 2,
            });
          },
        },
      );
      stopProgressEstimate(stopEstimate);
      stopEstimate = startEstimatedProgress(setProgressState, "preview");
      const nextPreview = await postJsonWithEstimatedProgress<S10ImportDraftPreview>(
        "/api/imports/s10/draft",
        {
          snapshot: exportBody.snapshot,
          budgetCode: budgetCode.trim(),
          companyId,
        },
        {
          onProcessing: () => {
            setProgressState({
              ...createProcessingProgress("preview", progressSource),
              title: "Preparando previsualizacion S10",
              detail: "Analizando presupuestos, partidas, APUs e insumos del snapshot exportado.",
              progress: 70,
              activeStepIndex: 3,
            });
          },
        },
      );

      stopProgressEstimate(stopEstimate);
      setLocalSnapshot(exportBody.snapshot);
      setSnapshotFile(null);
      setDraftPreview(nextPreview);
      setSelectedBudgetId(nextPreview.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
      setItemSearch("");
      setDraftState("success");
      setLocalExportState("success");
      setImportState("idle");
      setProgressState(createSuccessProgress("preview", progressSource));
    } catch (error) {
      stopProgressEstimate(stopEstimate);
      const message = error instanceof Error ? error.message : "No se pudo completar la previsualizacion S10.";
      setLocalExportState("error");
      setLocalExportError(message);
      setDraftState("error");
      setDraftError(message);
      setProgressState(createErrorProgress("preview", progressSource));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileSearch className="h-4 w-4 text-sky-600" />
                Analizador .s2k
              </div>
              <p className="text-sm text-slate-500">Firma, cabecera y tipo probable del respaldo S10.</p>
            </div>
            <StatusBadge state={analysisState} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input accept=".s2k,.S2K" type="file" onChange={(event) => setS2kFile(event.target.files?.[0] ?? null)} />
            <Button className="gap-2" disabled={analysisState === "loading"} onClick={analyzeS2kFile}>
              {analysisState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Analizar
            </Button>
          </div>

          {analysisError ? <InlineMessage tone="error" message={analysisError} /> : null}

          {analysis ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Tipo" value={analysis.analysis.detectedKind} />
                <Metric label="Firma" value={analysis.analysis.signature || "sin firma"} />
                <Metric label="Tamano" value={`${analysis.analysis.sizeBytes.toLocaleString("es-PE")} bytes`} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Vista ASCII</p>
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-slate-700">{analysis.analysis.asciiPreview}</pre>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Upload className="h-4 w-4 text-sky-600" />
                Restaurar respaldo .S2K
              </div>
              <p className="text-sm text-slate-500">
                Crea una base local de SQL Server desde un respaldo S10 antes de listar presupuestos y exportar el draft.
              </p>
            </div>
            <StatusBadge state={localRestoreState} />
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-1">
                <p className="text-sm font-medium text-slate-900">Origen del archivo</p>
                <p className="text-sm text-slate-500">
                  Buscar archivo es el flujo recomendado. Para archivos grandes, especialmente mayores a 100 MB, usa Ruta local si el .S2K
                  ya esta en la misma maquina donde corre npm.cmd run dev. Si esta en otra maquina, subelo con Buscar archivo, copialo a esta
                  maquina o usa una ruta compartida UNC como \\SERVIDOR\carpeta\obra.S2K.
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  className={createRestoreSourceModeClassName(restoreBackupSourceMode === "upload")}
                  type="button"
                  onClick={() => setRestoreBackupSourceMode("upload")}
                >
                  Buscar archivo
                </button>
                <button
                  className={createRestoreSourceModeClassName(restoreBackupSourceMode === "path")}
                  type="button"
                  onClick={() => {
                    setRestoreBackupSourceMode("path");
                    setLocalRestoreFile(null);
                  }}
                >
                  Ruta local
                </button>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(150px,220px)]">
              <div>
                {restoreBackupSourceMode === "upload" ? (
                  <Input
                    key="restore-file-input"
                    accept=".s2k,.S2K"
                    type="file"
                    onChange={(event) => setLocalRestoreFile(event.target.files?.[0] ?? null)}
                  />
                ) : (
                  <Input
                    key="restore-path-input"
                    value={localBackupPath}
                    onChange={(event) => setLocalBackupPath(event.target.value)}
                    placeholder="presupuesto-ejemplo\\s10\\obra.S2K"
                  />
                )}
              </div>
              <Input value={restoreDatabaseName} onChange={(event) => setRestoreDatabaseName(event.target.value)} placeholder="S10_OBRA_MYC" />
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <input
                  checked={replaceExistingDatabase}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  type="checkbox"
                  onChange={(event) => setReplaceExistingDatabase(event.target.checked)}
                />
                Reemplazar
              </label>
              <Button className="gap-2" disabled={localRestoreState === "loading"} onClick={restoreLocalS2kBackup}>
                {localRestoreState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Restaurar .S2K
              </Button>
            </div>
            {localRestoreError ? <InlineMessage tone="error" message={localRestoreError} /> : null}
            {progressState && progressState.action === "restore" ? (
              <ImportProgressPanel
                activeStepIndex={progressState.activeStepIndex}
                detail={progressState.detail}
                fileName={progressState.fileName}
                fileSize={progressState.fileSize}
                progress={progressState.progress}
                status={progressState.status}
                steps={restoreProgressSteps}
                title={progressState.title}
              />
            ) : null}
            {localRestoreResult ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Metric label="Base restaurada" value={localRestoreResult.database.databaseName} />
                <Metric label="Presupuestos" value={localRestoreResult.database.presupuestoCount.toString()} />
                <Metric label="Archivos" value={localRestoreResult.files.length.toString()} />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Server className="h-4 w-4 text-sky-600" />
              SQL Server S10 local
            </div>
            <p className="text-sm text-slate-500">Lee bases S10 existentes en SQL Server Express y genera el draft MYC.</p>
          </div>
          <StatusBadge state={localSqlState} />
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(240px,1fr)_minmax(140px,180px)_minmax(140px,180px)_auto]">
          <Input value={localServer} onChange={(event) => setLocalServer(event.target.value)} placeholder=".\SQLEXPRESS" />
          <Input value={localUser} onChange={(event) => setLocalUser(event.target.value)} placeholder="Usuario SQL" />
          <Input
            type="password"
            value={localPassword}
            onChange={(event) => setLocalPassword(event.target.value)}
            placeholder="Clave SQL"
          />
          <Button className="gap-2" disabled={localSqlState === "loading"} onClick={loadLocalDatabases}>
            {localSqlState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Buscar bases S10
          </Button>
        </div>
        {localSqlError ? <InlineMessage tone="error" message={localSqlError} /> : null}

        {localDatabases.length > 0 ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(220px,0.8fr)_minmax(220px,1fr)_auto_auto]">
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
              value={localDatabase}
              onChange={(event) => {
                setLocalDatabase(event.target.value);
                setLocalBudgets([]);
              }}
            >
              {localDatabases.map((database) => (
                <option key={database.databaseName} value={database.databaseName}>
                  {database.databaseName} ({database.presupuestoCount})
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={localBudgets.length === 0}
              value={budgetCode}
              onChange={(event) => setBudgetCode(event.target.value)}
            >
              {localBudgets.length === 0 ? (
                <option value={budgetCode}>{budgetCode || "Carga presupuestos"}</option>
              ) : (
                localBudgets.map((budget) => (
                  <option key={budget.code} value={budget.code}>
                    {budget.code} - {budget.description} ({budget.itemCount} partidas)
                  </option>
                ))
              )}
            </select>
            <Button className="gap-2" disabled={localBudgetState === "loading"} onClick={() => loadLocalBudgets()}>
              {localBudgetState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Ver presupuestos
            </Button>
            <Button className="gap-2" disabled={localExportState === "loading" || !companyId} onClick={previewFromLocalSqlServer}>
              {localExportState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
              Exportar y previsualizar
            </Button>
          </div>
        ) : null}
        {localBudgetError ? <InlineMessage tone="error" message={localBudgetError} /> : null}
        {localExportError ? <InlineMessage tone="error" message={localExportError} /> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileJson className="h-4 w-4 text-sky-600" />
              Draft MYC
            </div>
            <p className="text-sm text-slate-500">Previsualizacion de presupuestos, partidas, APUs e insumos.</p>
          </div>
          <StatusBadge state={draftState} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(160px,220px)_140px_auto]">
          <Input
            accept=".json,application/json"
            type="file"
            onChange={(event) => {
              setSnapshotFile(event.target.files?.[0] ?? null);
              setLocalSnapshot(null);
              setDraftPreview(null);
              setImportResult(null);
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
          <Input value={budgetCode} onChange={(event) => setBudgetCode(event.target.value)} placeholder="0201003" />
          <Button className="gap-2" disabled={draftState === "loading"} onClick={previewSnapshotDraft}>
            {draftState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Previsualizar
          </Button>
        </div>

        {draftError ? <InlineMessage tone="error" message={draftError} /> : null}
        {companies.length === 0 ? <InlineMessage tone="error" message="Crea una empresa antes de importar proyectos S10." /> : null}
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

      {hasPreview ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {draftPreview.projectName}
              </div>
              <p className="mt-1 text-sm text-slate-500">Presupuesto S10 {draftPreview.sourceBudgetCode}</p>
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
              <p className="text-sm text-slate-500">Importa este snapshot como un proyecto nuevo con presupuestos, APUs e insumos S10.</p>
            </div>
            <Button className="gap-2" disabled={importState === "loading" || (!snapshotFile && !localSnapshot) || !companyId} onClick={importSnapshotToMyc}>
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
                <label className="text-xs font-medium uppercase text-slate-500" htmlFor="s10-sub-budget-select">
                  Subpresupuesto
                </label>
                <select
                  id="s10-sub-budget-select"
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
                  <Input
                    className="pl-9"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Buscar partida"
                  />
                </div>
                <Badge>
                  {visibleItems.length} de {selectedBudget?.itemCount ?? 0}
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
                  {visibleItems.map((item) => (
                    <tr key={`${item.budgetName}-${item.code}-${item.description}`} className="text-slate-700">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{item.code}</td>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="whitespace-nowrap px-3 py-2">{item.unit}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatNumber(item.quantity)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(item.partial)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <ApuStatusBadge item={item} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {item.apuStatus === "PRICE_MISMATCH" ? (
                          <span className="text-amber-700">
                            PU APU {formatMoney(item.calculatedApuUnitPrice ?? 0)} / dif. {formatMoney(item.unitPriceDifference ?? 0)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
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

function InlineMessage({ message, tone }: { message: string; tone: "error" }) {
  const className = tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700";

  return <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${className}`}>{message}</div>;
}

function createRestoreSourceModeClassName(active: boolean) {
  return [
    "h-8 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70",
    active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
  ].join(" ");
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

function createLocalSqlServerParams(server: string, user: string, password: string) {
  const params = new URLSearchParams({ server: server.trim() || ".\\SQLEXPRESS" });

  if (user.trim()) {
    params.set("user", user.trim());
  }

  if (password.trim()) {
    params.set("password", password.trim());
  }

  return params;
}

function upsertLocalDatabase(databases: S10LocalDatabase[], nextDatabase: S10LocalDatabase) {
  const withoutCurrent = databases.filter((database) => database.databaseName !== nextDatabase.databaseName);
  return [nextDatabase, ...withoutCurrent].sort((left, right) => left.databaseName.localeCompare(right.databaseName));
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? "No se pudo completar la operacion.";
  } catch {
    return "No se pudo completar la operacion.";
  }
}

function createFileProgressSource(file: File, label: string): S10ProgressSource {
  return {
    fileName: file.name,
    fileSize: file.size,
    label,
  };
}

function createLocalSnapshotProgressSource(databaseName: string, budgetCode: string): S10ProgressSource {
  return {
    fileName: `${databaseName || "SQL Server S10"}${budgetCode.trim() ? ` - ${budgetCode.trim()}` : ""}`,
    fileSize: 0,
    label: "S10 local",
  };
}

function createRestoreBackupPathProgressSource(backupPath: string): S10ProgressSource {
  return {
    fileName: backupPath.trim() || "Respaldo S10",
    fileSize: 0,
    label: "respaldo S10",
  };
}

function createInitialProgress(action: S10ProgressAction, source: S10ProgressSource): S10ProgressState {
  return {
    action,
    status: "running",
    title:
      action === "preview"
        ? `Preparando previsualizacion ${source.label}`
        : action === "restore"
          ? `Preparando restauracion ${source.label}`
          : `Preparando importacion ${source.label}`,
    detail: action === "restore" ? "Validando respaldo, base destino y conexion SQL Server." : "Validando archivo, presupuesto y empresa.",
    progress: 5,
    activeStepIndex: 0,
    fileName: source.fileName,
    fileSize: source.fileSize,
  };
}

function createUploadProgress(action: S10ProgressAction, source: S10ProgressSource, uploadProgress: number): S10ProgressState {
  return {
    action,
    status: "running",
    title: `Subiendo ${source.label}`,
    detail: `Transferencia del archivo al servidor: ${Math.round(uploadProgress * 100)}%.`,
    progress: 10 + uploadProgress * 35,
    activeStepIndex: 1,
    fileName: source.fileName,
    fileSize: source.fileSize,
  };
}

function createProcessingProgress(action: S10ProgressAction, source: S10ProgressSource): S10ProgressState {
  return {
    action,
    status: "running",
    title:
      action === "preview"
        ? `Analizando snapshot ${source.label}`
        : action === "restore"
          ? `Restaurando base ${source.label}`
          : `Importando proyecto ${source.label}`,
    detail:
      action === "preview"
        ? "Leyendo presupuestos, subpresupuestos, partidas, APUs e insumos para armar la previsualizacion."
        : action === "restore"
          ? "SQL Server esta restaurando el respaldo y moviendo archivos de datos y log."
        : "Creando proyecto, presupuestos, partidas, APUs e insumos en MYC.",
    progress: action === "preview" ? 58 : 55,
    activeStepIndex: 2,
    fileName: source.fileName,
    fileSize: source.fileSize,
  };
}

function createSuccessProgress(action: S10ProgressAction, source: S10ProgressSource): S10ProgressState {
  return {
    action,
    status: "success",
    title:
      action === "preview"
        ? `Previsualizacion ${source.label} lista`
        : action === "restore"
          ? `Restauracion ${source.label} completada`
          : `Importacion ${source.label} completada`,
    detail:
      action === "preview"
        ? "Ya puedes revisar la estructura antes de crear el proyecto."
        : action === "restore"
          ? "La base S10 fue restaurada y verificada. Ya puedes listar sus presupuestos."
        : "El proyecto, sus presupuestos, partidas, APUs e insumos fueron creados correctamente.",
    progress: 100,
    activeStepIndex:
      action === "preview"
        ? previewProgressSteps.length - 1
        : action === "restore"
          ? restoreProgressSteps.length - 1
          : importProgressSteps.length - 1,
    fileName: source.fileName,
    fileSize: source.fileSize,
  };
}

function createErrorProgress(action: S10ProgressAction, source: S10ProgressSource): S10ProgressState {
  return {
    action,
    status: "error",
    title:
      action === "preview"
        ? `No se pudo previsualizar ${source.label}`
        : action === "restore"
          ? `No se pudo restaurar ${source.label}`
          : `No se pudo importar ${source.label}`,
    detail: "Revisa el mensaje de error y vuelve a intentarlo.",
    progress: 100,
    activeStepIndex:
      action === "preview"
        ? previewProgressSteps.length - 1
        : action === "restore"
          ? restoreProgressSteps.length - 1
          : importProgressSteps.length - 1,
    fileName: source.fileName,
    fileSize: source.fileSize,
  };
}

function startEstimatedProgress(
  setProgressState: Dispatch<SetStateAction<S10ProgressState | null>>,
  action: S10ProgressAction,
) {
  const maxProgress = action === "preview" ? 92 : action === "restore" ? 94 : 96;
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
          : action === "restore"
            ? nextProgress >= 88
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
            : action === "restore" && nextProgress >= 88
              ? "Verificando tablas S10 y presupuestos disponibles en la base restaurada."
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

async function postJsonWithEstimatedProgress<T>(
  endpoint: string,
  payload: unknown,
  handlers: {
    onProcessing: () => void;
  },
): Promise<T> {
  handlers.onProcessing();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
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
