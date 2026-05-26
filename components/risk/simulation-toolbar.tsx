import { Activity, Play, ShieldAlert } from "lucide-react";
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
  onRunSimulation: () => void;
  progress: number;
  status: SimulationStatus;
}) {
  const running = status === "running";
  const progressValue = Math.round(progress * 100);

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white">
                <Activity className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-semibold text-slate-950">Riesgos Monte Carlo</h1>
              <ContextBadge label={budgetKind === "GENERAL" ? "Presupuesto general" : "Subpresupuesto"} tone="slate" />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {budgetName} · Base {baseTotal} · {itemCount} partidas · {enabledVariables} variables activas
            </p>
          </div>

          <Button className="shrink-0" disabled={running || enabledVariables === 0} onClick={onRunSimulation}>
            <Play className="mr-2 h-4 w-4" />
            {running ? "Simulando..." : "Ejecutar simulacion"}
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <progress
            aria-label="Progreso de simulacion"
            className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-sky-600 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-sky-600"
            max={100}
            value={progressValue}
          />
          <p className="text-xs text-slate-500">
            {lastRunAt ? `Ultima simulacion: ${new Date(lastRunAt).toLocaleString("es-PE")}` : "Sin simulaciones guardadas"}
          </p>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
