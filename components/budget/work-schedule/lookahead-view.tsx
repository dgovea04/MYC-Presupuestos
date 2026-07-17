"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

export type LookaheadViewProps = {
  lines: WorkScheduleLineRecord[];
  asOfDate: string;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function LookaheadView({ lines, asOfDate }: LookaheadViewProps) {
  const [weeks, setWeeks] = useState<2 | 4 | 6>(2);
  const endDate = addDays(asOfDate, weeks * 7);

  const { starting, finishing, pendingPredecessors } = useMemo(() => {
    const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    const starting = lines.filter((line) => {
      const start = line.startDate ? new Date(`${line.startDate}T00:00:00.000Z`) : null;
      return start && start.getTime() >= asOf.getTime() && start.getTime() <= end.getTime();
    });

    const finishing = lines.filter((line) => {
      const endLine = line.endDate ? new Date(`${line.endDate}T00:00:00.000Z`) : null;
      return endLine && endLine.getTime() >= asOf.getTime() && endLine.getTime() <= end.getTime();
    });

    const pendingPredecessors = lines.filter((line) => {
      const start = line.startDate ? new Date(`${line.startDate}T00:00:00.000Z`) : null;
      return start && start.getTime() <= end.getTime() && (line.percentComplete ?? 0) < 100;
    });

    return { starting, finishing, pendingPredecessors };
  }, [lines, asOfDate, endDate]);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">Lookahead de obra</p>
            <p className="text-xs text-[var(--app-text-muted)]">
              Vista operativa desde {asOfDate} hasta {endDate}.
            </p>
          </div>
          <div className="flex gap-2">
            {[2, 4, 6].map((w) => (
              <Button
                key={w}
                variant={weeks === w ? "default" : "outline"}
                size="sm"
                onClick={() => setWeeks(w as 2 | 4 | 6)}
              >
                {w} semanas
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <LookaheadSection title="Inician" lines={starting} />
          <LookaheadSection title="Terminan" lines={finishing} />
          <LookaheadSection title="Predecesoras pendientes" lines={pendingPredecessors} />
        </div>
      </CardContent>
    </Card>
  );
}

function LookaheadSection({ title, lines }: { title: string; lines: WorkScheduleLineRecord[] }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">
        {title} ({lines.length})
      </p>
      {lines.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--app-text-muted)]">Sin partidas en este rango.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {lines.slice(0, 5).map((line) => (
            <li key={line.budgetItemId} className="text-xs text-[var(--app-text-muted)]">
              <span className="font-medium text-[var(--app-text-strong)]">{line.itemCode}</span> {line.description}
            </li>
          ))}
          {lines.length > 5 ? (
            <li className="text-xs text-[var(--app-text-muted)]">+{lines.length - 5} mas</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
