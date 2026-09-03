import { AlertTriangle, CircleDot, FileSearch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewRunView } from "./types";
import { reviewLabel, reviewStatusLabels } from "./labels";

const stageLabels: Record<ReviewRunView["progress"]["stage"], string> = {
  validating: "Validando fuentes",
  extracting: "Extrayendo documentos",
  classifying: "Clasificando evidencia",
  evidence: "Procesando evidencia",
  matching: "Relacionando partidas",
  rules: "Aplicando verificaciones",
  prioritizing: "Priorizando hallazgos",
  completed: "Revisión completada",
};

export function ReviewDashboard({ run }: { run?: ReviewRunView; findingCount: number; documentCount: number }) {
  if (!run) {
    return (
      <Card id="review-how-it-works" className="theme-surface-card">
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <FileSearch className="h-8 w-8 text-[var(--app-primary-soft)]" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-[var(--app-text-strong)]">Aún no hay revisiones</h3>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">Carga fuentes y crea una revisión para comparar tus partidas con evidencia documentada.</p>
          </div>
          <div className="flex gap-2"><Link href="#review-document-manager" className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white">Agregar documentos</Link><Link href="#review-how-it-works" className="rounded-xl border px-3 py-2 text-sm">Cómo funciona</Link></div>
        </CardContent>
      </Card>
    );
  }

  const warningLabel = run.warnings.length === 1 ? "1 advertencia de procesamiento" : `${run.warnings.length} advertencias de procesamiento`;
  const runFindingCount = run.metrics?.findingsByStatus ? Object.values(run.metrics.findingsByStatus).reduce((total, count) => total + count, 0) : undefined;

  return (
    <Card className="theme-surface-card" data-testid="review-dashboard">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Resumen de la revisión</CardTitle>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">Ejecución {run.id.slice(0, 8)} · {reviewLabel(reviewStatusLabels, run.status)}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
          <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
          {stageLabels[run.progress.stage]}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Progreso" value={`${run.progress.percent}%`} />
          <Metric label="Fuentes" value={run.metrics ? String(run.metrics.evidenceCount ?? 0) : "—"} />
          <Metric label="Hallazgos" value={run.metrics ? `${runFindingCount ?? 0} registrados` : "—"} />
          <Metric label="Cobertura" value={run.metrics?.coveragePercent !== undefined ? `${run.metrics.coveragePercent}%` : "—"} />
          <Metric label="Partidas analizadas" value={run.metrics?.analyzedItems?.toString() ?? "—"} />
          <Metric label="Fallos / incompletitud" value={run.metrics ? `${run.metrics.failedChecks ?? run.metrics.failures ?? 0} / ${run.metrics.incompleteItems ?? run.metrics.incompleteness ?? 0}` : "—"} />
        </div>
        <p className="text-sm text-[var(--app-text-muted)]">Delta vs ejecución anterior: {run.metrics?.deltaVsPrevious === undefined || run.metrics.deltaVsPrevious === null ? "—" : `${run.metrics.deltaVsPrevious > 0 ? "+" : ""}${run.metrics.deltaVsPrevious}`}</p>
        <div aria-label="Progreso por etapas" className="space-y-2">
          <div className="flex justify-between text-xs text-[var(--app-text-muted)]"><span>{stageLabels[run.progress.stage]}</span><span>{run.progress.completed}/{run.progress.total}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress.percent} aria-label={`Progreso de revisión: ${run.progress.percent}%`}>
            <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, run.progress.percent))}%` }} />
          </div>
        </div>
        {run.warnings.length > 0 ? (
          <div className="theme-status-warning flex items-start gap-2 rounded-xl border px-3 py-2 text-sm" role="status">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div><p className="font-medium">{warningLabel}</p><ul className="mt-1 list-disc pl-4">{run.warnings.map((warning) => <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>)}</ul></div>
          </div>
        ) : null}
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span><strong>Revisión humana requerida.</strong> No se generan cambios automáticos en el presupuesto.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-3"><p className="min-h-8 text-xs leading-4 text-[var(--app-text-muted)]">{label}</p><p className="mt-2 whitespace-nowrap text-base font-semibold tabular-nums text-[var(--app-text-strong)]">{value}</p></div>;
}
