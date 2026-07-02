import { Activity, Download, Play, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContextBadge } from "@/components/ui/context-badges";
import type { RiskBudgetKind } from "@/types/risk";

type SimulationStatus = "idle" | "running" | "completed" | "failed";

export function SimulationToolbar({
  baseTotal,
  budgetKind,
  budgetName,
  enabledVariables,
  error,
  itemCount,
  lastRunAt,
  onExportPdf,
  onRunSimulation,
  progress,
  status,
}: {
  baseTotal: string;
  budgetKind: RiskBudgetKind;
  budgetName: string;
  enabledVariables: number;
  error: string;
  itemCount: number;
  lastRunAt: string | null;
  onExportPdf: () => void;
  onRunSimulation: () => void;
  progress: number;
  status: SimulationStatus;
}) {
  const running = status === "running";
  const progressValue = Math.round(progress * 100);

  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="theme-quick-action-primary-icon inline-flex h-9 w-9 items-center justify-center rounded-xl">
                <Activity className="h-4 w-4" />
              </span>
              <h1 className="theme-strong-text text-xl font-semibold">Riesgos Monte Carlo</h1>
              <ContextBadge label={budgetKind === "GENERAL" ? "Presupuesto general" : "Subpresupuesto"} tone="slate" />
            </div>
            <p className="theme-muted-text mt-2 text-sm">
              {budgetName} · Base {baseTotal} · {itemCount} partidas · {enabledVariables} variables activas
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button disabled={!lastRunAt || running} onClick={onExportPdf} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button disabled={running || enabledVariables === 0} onClick={onRunSimulation}>
              <Play className="mr-2 h-4 w-4" />
              {running ? "Simulando..." : "Ejecutar simulacion"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <progress
            aria-label="Progreso de simulacion"
            className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-sky-600 [&::-webkit-progress-bar]:bg-[var(--app-surface-muted)] [&::-webkit-progress-value]:bg-sky-600"
            max={100}
            value={progressValue}
          />
          <p className="theme-muted-text text-xs">
            {lastRunAt ? `Ultima simulacion: ${new Date(lastRunAt).toLocaleString("es-PE")}` : "Sin simulaciones guardadas"}
          </p>
        </div>

        {error ? (
          <div className="theme-status-error flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
