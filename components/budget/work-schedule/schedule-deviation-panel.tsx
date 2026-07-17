"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkScheduleDeviation } from "@/lib/work-schedule/progress";

type DeviationGroup = {
  kind: WorkScheduleDeviation["kind"];
  label: string;
  items: WorkScheduleDeviation[];
};

const KIND_LABELS: Record<WorkScheduleDeviation["kind"], string> = {
  late: "Atrasadas",
  ahead: "Adelantadas",
  missing_actual_progress: "Sin avance real",
  critical_low_progress: "Criticas con bajo avance",
  baseline_variance: "Variacion contra baseline",
};

export type ScheduleDeviationPanelProps = {
  deviations: WorkScheduleDeviation[];
};

export function ScheduleDeviationPanel({ deviations }: ScheduleDeviationPanelProps) {
  const groups = useMemo<DeviationGroup[]>(() => {
    const map = new Map<WorkScheduleDeviation["kind"], WorkScheduleDeviation[]>();
    for (const deviation of deviations) {
      const existing = map.get(deviation.kind) ?? [];
      existing.push(deviation);
      map.set(deviation.kind, existing);
    }

    return Array.from(map.entries()).map(([kind, items]) => ({
      kind,
      label: KIND_LABELS[kind],
      items,
    }));
  }, [deviations]);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Panel de desviaciones</p>
          <p className="text-xs text-[var(--app-text-muted)]">
            Resumen de partidas con desviaciones detectadas.
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 text-sm text-[var(--app-text-muted)]">
            No se detectan desviaciones.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.kind}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">
                  {group.label} ({group.items.length})
                </p>
                <ul className="mt-2 space-y-1">
                  {group.items.slice(0, 5).map((item) => (
                    <li key={item.budgetItemId} className="text-xs text-[var(--app-text-muted)]">
                      <span className="font-medium text-[var(--app-text-strong)]">{item.itemCode}</span> {item.description}
                    </li>
                  ))}
                  {group.items.length > 5 ? (
                    <li className="text-xs text-[var(--app-text-muted)]">
                      +{group.items.length - 5} mas
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
