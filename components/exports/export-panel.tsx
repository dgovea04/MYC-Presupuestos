"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Download, Eye, FileArchive, FileSpreadsheet, FileText, Loader2, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExportDefinition, ExportFormat, ExportOptions, ExportPreset, ExportRequest } from "@/lib/exports/definitions";

type ExportPanelProps = {
  definition: ExportDefinition;
  targetId: string;
  defaultPreset: ExportPreset;
  contextOptions?: Partial<ExportOptions>;
  className?: string;
  buttonLabel?: string;
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  pdf: "PDF",
  xlsx: "Excel",
  zip: "ZIP",
};

const FORMAT_ICONS: Record<ExportFormat, typeof FileText> = {
  csv: FileText,
  pdf: FileText,
  xlsx: FileSpreadsheet,
  zip: FileArchive,
};

export function ExportPanel({
  buttonLabel = "Exportar",
  className,
  contextOptions,
  defaultPreset,
  definition,
  targetId,
}: ExportPanelProps) {
  const defaultPresetDefinition = definition.presets.find((preset) => preset.id === defaultPreset) ?? definition.presets[0];
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<ExportPreset>(defaultPresetDefinition.id);
  const preset = definition.presets.find((candidate) => candidate.id === presetId) ?? defaultPresetDefinition;
  const [format, setFormat] = useState<ExportFormat>(preset.defaultFormat);
  const [includeSignature, setIncludeSignature] = useState(contextOptions?.includeSignature ?? true);
  const [includeSubtotals, setIncludeSubtotals] = useState(contextOptions?.includeSubtotals ?? true);
  const [includeTotals, setIncludeTotals] = useState(contextOptions?.includeTotals ?? true);
  const [includeGanttChart, setIncludeGanttChart] = useState(contextOptions?.includeGanttChart ?? true);
  const [includeCurveChart, setIncludeCurveChart] = useState(contextOptions?.includeCurveChart ?? true);
  const [includeCriticalPath, setIncludeCriticalPath] = useState(contextOptions?.includeCriticalPath ?? false);
  const [currencyDecimals, setCurrencyDecimals] = useState(contextOptions?.currencyDecimals ?? 2);
  const [status, setStatus] = useState<"idle" | "downloading" | "previewing" | "error">("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ blob: Blob; fileName: string; key: string; url: string } | null>(null);
  const resolvedFormat = preset.formats.includes(format) ? format : preset.defaultFormat;
  const summary = useMemo(() => buildExportSummary(definition.label, preset.label, resolvedFormat), [definition.label, preset.label, resolvedFormat]);
  const payload = useMemo<ExportRequest>(
    () => ({
      target: definition.target,
      targetId,
      format: resolvedFormat,
      preset: preset.id,
      options: {
        ...contextOptions,
        includeSignature,
        includeSubtotals,
        includeTotals,
        includeGanttChart,
        includeCurveChart,
        includeCriticalPath,
        currencyDecimals,
      },
    }),
    [contextOptions, currencyDecimals, definition.target, includeCriticalPath, includeCurveChart, includeGanttChart, includeSignature, includeSubtotals, includeTotals, preset.id, resolvedFormat, targetId],
  );
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const canPreviewPdf = resolvedFormat === "pdf";
  const visiblePreview = preview?.key === payloadKey ? preview : null;

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  async function handleDownload() {
    setStatus("downloading");
    setError("");

    try {
      const result = visiblePreview ? { blob: visiblePreview.blob, fileName: visiblePreview.fileName } : await requestExportBlob(payload, preset.id, resolvedFormat);
      downloadBlob(result.fileName, result.blob);
      setStatus("idle");
      setOpen(false);
    } catch (downloadError) {
      setStatus("error");
      setError(downloadError instanceof Error ? downloadError.message : "No se pudo generar la exportacion");
    }
  }

  async function handlePreview() {
    if (!canPreviewPdf) return;
    setStatus("previewing");
    setError("");

    try {
      const result = await requestExportBlob(payload, preset.id, resolvedFormat);
      const url = URL.createObjectURL(result.blob);
      setPreview((current) => {
        if (current) {
          URL.revokeObjectURL(current.url);
        }
        return { blob: result.blob, fileName: result.fileName, key: payloadKey, url };
      });
      setStatus("idle");
    } catch (previewError) {
      setStatus("error");
      setError(previewError instanceof Error ? previewError.message : "No se pudo generar la previsualizacion");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && preview) {
          URL.revokeObjectURL(preview.url);
          setPreview(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button className={cn("gap-2", className)} variant="secondary">
          <Download className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className={cn("fixed right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-slate-200 bg-white shadow-2xl focus:outline-none", canPreviewPdf ? "max-w-6xl" : "max-w-md")}>
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-950">Preparar exportacion</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">{definition.label}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" type="button">
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </button>
            </Dialog.Close>
          </div>

          <div className={cn("flex-1 gap-5 overflow-y-auto px-6 py-5", canPreviewPdf ? "grid lg:grid-cols-[360px_1fr]" : "block")}>
            <div className="space-y-5">
              <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Settings2 className="h-3.5 w-3.5" />
                Preset
              </div>
              <div className="grid gap-2">
                {definition.presets.map((candidate) => (
                  <button
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                      candidate.id === preset.id ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                    key={candidate.id}
                    onClick={() => {
                      setPresetId(candidate.id);
                      setFormat(candidate.defaultFormat);
                    }}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{candidate.label}</span>
                      {candidate.id === preset.id ? <Check className="h-4 w-4 text-sky-600" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{candidate.description}</span>
                  </button>
                ))}
              </div>
              </section>

              <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato</p>
              <div className="grid grid-cols-2 gap-2">
                {preset.formats.map((candidate) => {
                  const Icon = FORMAT_ICONS[candidate];
                  return (
                    <button
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                        candidate === resolvedFormat ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-700 hover:bg-slate-50",
                      )}
                      key={candidate}
                      onClick={() => setFormat(candidate)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" />
                      {FORMAT_LABELS[candidate]}
                    </button>
                  );
                })}
              </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opciones</p>
              <ExportCheckbox checked={includeSubtotals} label="Incluir subtotales" onChange={setIncludeSubtotals} />
              <ExportCheckbox checked={includeTotals} label="Incluir total general" onChange={setIncludeTotals} />
              <ExportCheckbox checked={includeSignature} label="Incluir logo y firma" onChange={setIncludeSignature} />
              {definition.target === "work_schedule" && resolvedFormat === "pdf" && (preset.id === "cronograma_ejecutivo" || preset.id === "cronograma_partidas") ? (
                <ExportCheckbox checked={includeGanttChart} label="Incluir Gantt" onChange={setIncludeGanttChart} />
              ) : null}
              {definition.target === "work_schedule" && resolvedFormat === "pdf" && includeGanttChart && (preset.id === "cronograma_ejecutivo" || preset.id === "cronograma_partidas") ? (
                <ExportCheckbox checked={includeCriticalPath} label="Incluir ruta critica" onChange={setIncludeCriticalPath} />
              ) : null}
              {definition.target === "work_schedule" && resolvedFormat === "pdf" && (preset.id === "cronograma_ejecutivo" || preset.id === "curva_s") ? (
                <ExportCheckbox checked={includeCurveChart} label="Incluir grafico Curva S" onChange={setIncludeCurveChart} />
              ) : null}
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                Decimales
                <input
                  className="h-9 w-20 rounded-xl border border-slate-300 bg-white px-3 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  max={4}
                  min={0}
                  onChange={(event) => setCurrencyDecimals(Number(event.target.value))}
                  type="number"
                  value={currencyDecimals}
                />
              </label>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{summary}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">La descarga se genera al momento y no se guarda en historial.</p>
              </section>

              {status === "error" ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            </div>

            {canPreviewPdf ? (
              <section className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Vista previa PDF</p>
                    <p className="text-xs text-slate-500">Se actualiza con las opciones seleccionadas.</p>
                  </div>
                  <Button className="gap-2" disabled={status === "previewing"} onClick={() => void handlePreview()} variant="secondary">
                    {status === "previewing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Previsualizar
                  </Button>
                </div>
                {visiblePreview ? (
                  <iframe className="min-h-[520px] flex-1 bg-white" src={visiblePreview.url} title="Previsualizacion PDF" />
                ) : (
                  <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-slate-500">
                    Genera una vista previa para revisar cortes de pagina, columnas y margenes antes de descargar.
                  </div>
                )}
              </section>
            ) : null}
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <Button className="w-full gap-2" disabled={status === "downloading" || status === "previewing"} onClick={() => void handleDownload()}>
              {status === "downloading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExportCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
      <span>{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function buildExportSummary(moduleLabel: string, presetLabel: string, format: ExportFormat) {
  return `${moduleLabel} - ${presetLabel} en formato ${FORMAT_LABELS[format]}.`;
}

function resolveDownloadFileName(response: Response, preset: ExportPreset, format: ExportFormat) {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? `${preset}.${format}`;
}

async function requestExportBlob(payload: ExportRequest, preset: ExportPreset, format: ExportFormat) {
  const response = await fetch("/api/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo generar la exportacion");
  }

  return {
    blob: await response.blob(),
    fileName: resolveDownloadFileName(response, preset, format),
  };
}

function downloadBlob(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
