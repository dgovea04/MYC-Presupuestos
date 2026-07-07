"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Clock, User, ArrowRight } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { BudgetChangeRecord } from "@/types/collaboration";

interface BudgetChangeHistorySheetProps {
  open: boolean;
  budgetId: string;
  onClose: () => void;
}

export const BudgetChangeHistorySheet = memo(function BudgetChangeHistorySheet({
  open,
  budgetId,
  onClose,
}: BudgetChangeHistorySheetProps) {
  const [events, setEvents] = useState<BudgetChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");

      const response = await fetch(
        `/api/budgets/${budgetId}/collaboration/history?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to load history");

      const data = (await response.json()) as {
        events: BudgetChangeRecord[];
      };
      setEvents(data.events);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, fetchHistory]);

  const entityTypes = [...new Set(events.map((e) => e.entityType))];
  const filteredEvents =
    entityFilter === "all"
      ? events
      : events.filter((e) => e.entityType === entityFilter);

  if (!open) return null;

  return (
    <div className="flex h-full flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--app-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">
            Historial de cambios
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
          aria-label="Cerrar historial"
        >
          ×
        </button>
      </div>

      {/* Filters */}
      {entityTypes.length > 1 ? (
        <div className="flex shrink-0 gap-1 border-b border-[var(--app-border-soft)] px-4 py-2">
          <FilterChip
            active={entityFilter === "all"}
            onClick={() => setEntityFilter("all")}
          >
            Todos
          </FilterChip>
          {entityTypes.map((type) => (
            <FilterChip
              key={type}
              active={entityFilter === type}
              onClick={() => setEntityFilter(type)}
            >
              {formatEntityType(type)}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {/* Events list */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-[var(--app-text-muted)]">
            Cargando historial...
          </p>
        ) : filteredEvents.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--app-text-muted)]">
            Sin cambios registrados aun
          </p>
        ) : (
          <div className="space-y-1">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-[var(--app-surface-hover)]"
              >
                <div className="mt-0.5 shrink-0">
                  <User className="h-3.5 w-3.5 text-[var(--app-text-muted)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--app-text-strong)]">
                      {event.userName ?? "Sistema"}
                    </span>
                    <span className="text-[10px] text-[var(--app-text-muted)]">
                      {formatDate(event.createdAt)}
                    </span>
                    {event.source !== "USER" ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                        {event.source}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                    <span className="font-medium">
                      {formatEntityType(event.entityType)}
                    </span>{" "}
                    · {event.action}
                  </p>
                  {event.diffSummary ? (
                    <p className="mt-0.5 text-xs text-[var(--app-text)]">
                      {event.diffSummary}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition",
        active
          ? "bg-sky-100 text-sky-700"
          : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]",
      )}
    >
      {children}
    </button>
  );
}

function formatEntityType(type: string): string {
  const labels: Record<string, string> = {
    BUDGET: "Presupuesto",
    BUDGET_ITEM: "Partida",
    APU: "APU",
    APU_RESOURCE: "Insumo",
    METRADO_SHEET: "Metrado",
    METRADO_ROW: "Fila metrado",
    WORK_SCHEDULE_ITEM: "Cronograma",
  };
  return labels[type] ?? type;
}
