"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
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
import type { S10ImportPreview } from "@/lib/s10/s2k-analyzer";
import type { S10ImportDraftPreview } from "@/lib/s10/import-preview";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

type RequestState = "idle" | "loading" | "success" | "error";

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

type S10ImporterPageContentProps = {
  companies: CompanyOption[];
};

export function S10ImporterPageContent({ companies }: S10ImporterPageContentProps) {
  const [s2kFile, setS2kFile] = useState<File | null>(null);
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [budgetCode, setBudgetCode] = useState("0201003");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [analysisState, setAnalysisState] = useState<RequestState>("idle");
  const [localSqlState, setLocalSqlState] = useState<RequestState>("idle");
  const [localBudgetState, setLocalBudgetState] = useState<RequestState>("idle");
  const [localExportState, setLocalExportState] = useState<RequestState>("idle");
  const [draftState, setDraftState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [analysis, setAnalysis] = useState<S10ImportPreview | null>(null);
  const [localServer, setLocalServer] = useState("np:\\\\.\\pipe\\SQLLocal\\SQLEXPRESS");
  const [localUser, setLocalUser] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [localDatabase, setLocalDatabase] = useState("");
  const [localDatabases, setLocalDatabases] = useState<S10LocalDatabase[]>([]);
  const [localBudgets, setLocalBudgets] = useState<S10LocalBudget[]>([]);
  const [localSnapshot, setLocalSnapshot] = useState<S10ExportSnapshot | null>(null);
  const [draftPreview, setDraftPreview] = useState<S10ImportDraftPreview | null>(null);
  const [importResult, setImportResult] = useState<S10ImportResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [localSqlError, setLocalSqlError] = useState("");
  const [localBudgetError, setLocalBudgetError] = useState("");
  const [localExportError, setLocalExportError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [importError, setImportError] = useState("");
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const hasPreview = draftPreview != null;
  const warningCount = draftPreview?.warnings.length ?? 0;
  const totalItems = useMemo(
    () => draftPreview?.budgets.reduce((sum, budget) => sum + budget.itemCount, 0) ?? 0,
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

    const formData = new FormData();
    formData.set("file", snapshotFile);
    if (budgetCode.trim()) {
      formData.set("budgetCode", budgetCode.trim());
    }
    if (companyId) {
      formData.set("companyId", companyId);
    }

    const response = await fetch("/api/imports/s10/draft", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      setDraftState("error");
      setDraftError(await readApiError(response));
      return;
    }

    const nextPreview = (await response.json()) as S10ImportDraftPreview;
    setLocalSnapshot(null);
    setDraftPreview(nextPreview);
    setSelectedBudgetId(nextPreview.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
    setItemSearch("");
    setDraftState("success");
    setImportState("idle");
    setImportError("");
    setImportResult(null);
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

    const response =
      localSnapshot && !snapshotFile
        ? await fetch("/api/imports/s10/import", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              snapshot: localSnapshot,
              companyId,
              budgetCode: budgetCode.trim() || undefined,
            }),
          })
        : await importSnapshotFileToMyc();

    if (!response.ok) {
      setImportState("error");
      setImportError(await readApiError(response));
      return;
    }

    setImportResult((await response.json()) as S10ImportResult);
    setImportState("success");
  }

  async function importSnapshotFileToMyc() {
    if (!snapshotFile) {
      throw new Error("Selecciona el snapshot JSON exportado desde S10.");
    }

    const formData = new FormData();
    formData.set("file", snapshotFile);
    formData.set("companyId", companyId);
    if (budgetCode.trim()) {
      formData.set("budgetCode", budgetCode.trim());
    }

    return fetch("/api/imports/s10/import", {
      method: "POST",
      body: formData,
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

    const exportResponse = await fetch("/api/imports/s10/sqlserver/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        server: localServer.trim() || ".\\SQLEXPRESS",
        databaseName: localDatabase,
        budgetCode: budgetCode.trim(),
        user: localUser.trim() || undefined,
        password: localPassword.trim() || undefined,
      }),
    });

    if (!exportResponse.ok) {
      const message = await readApiError(exportResponse);
      setLocalExportState("error");
      setLocalExportError(message);
      setDraftState("error");
      setDraftError(message);
      return;
    }

    const exportBody = (await exportResponse.json()) as { snapshot: S10ExportSnapshot };
    const draftResponse = await fetch("/api/imports/s10/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        snapshot: exportBody.snapshot,
        budgetCode: budgetCode.trim(),
        companyId,
      }),
    });

    if (!draftResponse.ok) {
      const message = await readApiError(draftResponse);
      setLocalExportState("error");
      setLocalExportError(message);
      setDraftState("error");
      setDraftError(message);
      return;
    }

    const nextPreview = (await draftResponse.json()) as S10ImportDraftPreview;
    setLocalSnapshot(exportBody.snapshot);
    setSnapshotFile(null);
    setDraftPreview(nextPreview);
    setSelectedBudgetId(nextPreview.budgets.find((budget) => budget.kind === "SUB_BUDGET")?.id ?? "");
    setItemSearch("");
    setDraftState("success");
    setLocalExportState("success");
    setImportState("idle");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Server className="h-4 w-4 text-sky-600" />
              SQL Server S10 local
            </div>
            <p className="text-sm text-slate-500">Lee bases S10 existentes en SQL Server Express y genera el draft sin restaurar un .S2K.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge state={localSqlState} />
            <StatusBadge state={localBudgetState} />
            <StatusBadge state={localExportState} />
          </div>
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
              <Badge>{warningCount} advertencias</Badge>
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

          {importError ? <InlineMessage tone="error" message={importError} /> : null}
          {importResult ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{importResult.projectName}</p>
                  <p className="text-sm text-emerald-700">
                    {importResult.budgetCount} presupuestos, {importResult.itemCount} partidas, {importResult.apuCount} APUs
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

          {draftPreview.warnings.length > 0 ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertCircle className="h-4 w-4" />
                Advertencias de conversion
              </div>
              <ul className="mt-3 space-y-1 text-sm text-amber-900">
                {draftPreview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
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

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? "No se pudo completar la operacion.";
  } catch {
    return "No se pudo completar la operacion.";
  }
}
