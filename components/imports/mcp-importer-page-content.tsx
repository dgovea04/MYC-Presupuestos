"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileArchive,
  Loader2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RequestState = "idle" | "loading" | "success" | "error";

type CompanyOption = {
  id: string;
  name: string;
};

type McpAnalyzeResult = {
  compatibility: "supported" | "supported_with_warnings" | "unsupported";
  projectName: string;
  formatVersion: string;
  sourceApp: string;
  sourceAppVersion: string;
  modules: Array<{
    id: string;
    present: boolean;
    required: boolean;
  }>;
  warnings: string[];
  errors: string[];
  fileEntries: Record<string, string>;
};

type McpImportResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  budgetCount: number;
  itemCount: number;
  apuCount: number;
  resourceCount: number;
  warnings: string[];
};

type McpImporterPageContentProps = {
  companies: CompanyOption[];
};

export function McpImporterPageContent({ companies }: McpImporterPageContentProps) {
  const [mcpFile, setMcpFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [analysisState, setAnalysisState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [analysis, setAnalysis] = useState<McpAnalyzeResult | null>(null);
  const [importResult, setImportResult] = useState<McpImportResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [importError, setImportError] = useState("");

  const presentModuleCount = useMemo(
    () => analysis?.modules.filter((module) => module.present).length ?? 0,
    [analysis],
  );
  const totalModuleCount = analysis?.modules.length ?? 0;

  async function analyzeMcpFile() {
    if (!mcpFile) {
      setAnalysisError("Selecciona un archivo .mcp.");
      setAnalysisState("error");
      return;
    }

    setAnalysisState("loading");
    setAnalysisError("");
    setImportResult(null);
    setImportError("");

    const formData = new FormData();
    formData.set("file", mcpFile);

    try {
      const response = await fetch("/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo analizar el archivo .mcp.");
      }

      const result = (await response.json()) as McpAnalyzeResult;
      setAnalysis(result);
      setAnalysisState("success");
    } catch (error) {
      setAnalysisState("error");
      setAnalysisError(error instanceof Error ? error.message : "No se pudo analizar el archivo .mcp.");
    }
  }

  async function importMcpToMyc() {
    if (!mcpFile) {
      setImportError("Selecciona un archivo .mcp.");
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

    const formData = new FormData();
    formData.set("file", mcpFile);
    formData.set("companyId", companyId);

    try {
      const response = await fetch("/api/imports/mcp/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo importar el proyecto .mcp.");
      }

      const result = (await response.json()) as McpImportResult;
      setImportResult(result);
      setImportState("success");
    } catch (error) {
      setImportState("error");
      setImportError(error instanceof Error ? error.message : "No se pudo importar el proyecto .mcp.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <FileArchive className="h-4 w-4 text-sky-600" />
              Archivo .mcp
            </div>
            <p className="text-sm text-[var(--app-text-muted)]">
              Selecciona un paquete .mcp exportado desde MC Presupuestos para analizar e importar.
            </p>
          </div>
          <StatusBadge state={analysisState} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(160px,220px)_auto_auto]">
          <Input accept=".mcp" type="file" onChange={(event) => setMcpFile(event.target.files?.[0] ?? null)} />
          <select
            className="h-10 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500 disabled:bg-[var(--app-surface-elevated)] disabled:text-[var(--app-text-subtle)]"
            disabled={companies.length === 0}
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
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
          <Button className="gap-2" disabled={analysisState === "loading" || !mcpFile} onClick={analyzeMcpFile}>
            {analysisState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Analizar
          </Button>
        </div>

        {companies.length === 0 ? <InlineMessage tone="error" message="Crea una empresa antes de importar proyectos .mcp." /> : null}
        {analysisError ? <InlineMessage tone="error" message={analysisError} /> : null}
      </section>

      {analysis && analysis.compatibility !== "unsupported" ? (
        <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {analysis.projectName}
              </div>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                Formato {analysis.formatVersion} &middot; Exportado desde {analysis.sourceApp} {analysis.sourceAppVersion}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>
                {presentModuleCount}/{totalModuleCount} modulos
              </Badge>
              {analysis.compatibility === "supported_with_warnings" ? (
                <Badge className="theme-status-warning">{analysis.warnings.length} advertencias</Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--app-text-strong)]">Crear proyecto en MC</p>
              <p className="text-sm text-[var(--app-text-muted)]">
                Restaura este paquete como un proyecto nuevo con todos sus presupuestos, APUs y configuracion.
              </p>
            </div>
            <Button className="gap-2" disabled={importState === "loading" || !companyId} onClick={importMcpToMyc}>
              {importState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar a MC
            </Button>
          </div>

          {analysis.warnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">Advertencias</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700 dark:text-amber-400">
                {analysis.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {importError ? <InlineMessage tone="error" message={importError} /> : null}

          {importResult ? (
            <div className="theme-status-success mt-4 rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="theme-status-success-strong text-sm font-semibold">{importResult.projectName}</p>
                  <p className="text-sm">
                    {formatCount(importResult.budgetCount, "presupuesto", "presupuestos")},{" "}
                    {formatCount(importResult.itemCount, "partida", "partidas")},{" "}
                    {importResult.apuCount} APUs
                  </p>
                  {importResult.warnings.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-600">
                      {importResult.warnings.length} advertencias durante la importacion
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="theme-status-link-success inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                    href={`/projects/${importResult.projectId}`}
                  >
                    Proyecto
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    className="theme-status-link-success inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                    href={`/budgets/${importResult.generalBudgetId}`}
                  >
                    Presupuesto
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
            <div className="border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-4 py-3">
              <p className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">Modulos detectados</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--app-surface-elevated)] text-xs uppercase text-[var(--app-text-muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Modulo</th>
                  <th className="px-4 py-2 font-medium">Obligatorio</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border-soft)] bg-[var(--app-surface)]">
                {analysis.modules.map((module) => (
                  <tr key={module.id} className="text-[var(--app-text-muted)]">
                    <td className="px-4 py-2 font-medium text-[var(--app-text-strong)]">{module.id}</td>
                    <td className="px-4 py-2">{module.required ? "Si" : "No"}</td>
                    <td className="px-4 py-2">
                      {module.present ? (
                        <Badge className="theme-status-success">Presente</Badge>
                      ) : module.required ? (
                        <Badge className="theme-status-error">Faltante</Badge>
                      ) : (
                        <span className="text-[var(--app-text-subtle)]">No incluido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {analysis && analysis.compatibility === "unsupported" ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            El paquete .mcp no es compatible con esta version de MC Presupuestos
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-400">
            {analysis.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ state }: { state: RequestState }) {
  if (state === "loading") {
    return <Badge className="theme-status-info">Procesando</Badge>;
  }

  if (state === "success") {
    return <Badge className="theme-status-success">Listo</Badge>;
  }

  if (state === "error") {
    return <Badge className="theme-status-error">Error</Badge>;
  }

  return <Badge>Pendiente</Badge>;
}

function InlineMessage({ message, tone }: { message: string; tone: "error" }) {
  const className = tone === "error"
    ? "theme-status-error"
    : "border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)]";

  return <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${className}`}>{message}</div>;
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
