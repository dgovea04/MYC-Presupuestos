"use client";

import { cn } from "@/lib/utils";
import {
  FileSearch,
  FileText,
  GitCompareArrows,
  Lightbulb,
  Search,
  TrendingUp,
} from "lucide-react";

export type KhipuQuickAction = {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
  onSelect: () => void;
};

const DEFAULT_QUICK_ACTIONS: KhipuQuickAction[] = [
  {
    id: "analyze-budget",
    label: "Analizar presupuesto",
    description: "Detecta partidas que requieren revisión.",
    icon: Search,
    onSelect: () => {},
  },
  {
    id: "review-apu",
    label: "Revisar APU",
    description: "Evalúa insumos, rendimientos y coherencia técnica.",
    icon: FileSearch,
    onSelect: () => {},
  },
  {
    id: "compare",
    label: "Comparar alternativas",
    description: "Compara soluciones y escenarios de costo.",
    icon: GitCompareArrows,
    onSelect: () => {},
  },
  {
    id: "optimize",
    label: "Optimizar costos",
    description: "Sugiere alternativas para reducir costos.",
    icon: TrendingUp,
    onSelect: () => {},
  },
  {
    id: "report",
    label: "Generar reporte",
    description: "Resume observaciones para el equipo técnico.",
    icon: FileText,
    onSelect: () => {},
  },
  {
    id: "inconsistencies",
    label: "Detectar inconsistencias",
    description: "Identifica posibles errores en cantidades y unidades.",
    icon: Lightbulb,
    onSelect: () => {},
  },
];

type KhipuQuickActionsProps = {
  actions?: KhipuQuickAction[];
  className?: string;
};

export function KhipuQuickActions({
  actions = DEFAULT_QUICK_ACTIONS,
  className,
}: KhipuQuickActionsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3", className)}>
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.id}
            type="button"
            className="group flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left shadow-sm transition hover:border-cyan-300 hover:bg-[var(--app-surface-hover)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            onClick={action.onSelect}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-primary-muted)] text-cyan-600 transition group-hover:scale-105 group-hover:bg-cyan-100">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--app-text-strong)]">
                {action.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--app-text-muted)]">
                {action.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
