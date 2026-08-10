"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { History, RotateCcw, User, AlertTriangle } from "lucide-react";
import { CollaborationSheetSkeleton } from "@/components/loading/collaboration-sheet-skeleton";
import { cn, formatDate } from "@/lib/utils";
import type { BudgetVersionRecord } from "@/types/collaboration";

interface BudgetVersionHistorySheetProps {
  open: boolean;
  budgetId: string;
  onClose: () => void;
}

export const BudgetVersionHistorySheet = memo(function BudgetVersionHistorySheet({
  open,
  budgetId,
  onClose,
}: BudgetVersionHistorySheetProps) {
  const [versions, setVersions] = useState<BudgetVersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/budgets/${budgetId}/collaboration/versions?limit=20`,
      );
      if (!response.ok) throw new Error("Failed to load versions");

      const data = (await response.json()) as {
        versions: BudgetVersionRecord[];
      };
      setVersions(data.versions);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open, fetchVersions]);

  const handleRestore = useCallback(
    async (versionId: string) => {
      setRestoringId(versionId);
      try {
        await fetch(
          `/api/budgets/${budgetId}/collaboration/versions/${versionId}/restore`,
          { method: "POST" },
        );
        setShowConfirmRestore(null);
        await fetchVersions();
      } catch {
        // silent
      } finally {
        setRestoringId(null);
      }
    },
    [budgetId, fetchVersions],
  );

  if (!open) return null;

  return (
    <div className="flex h-full flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--app-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">
            Versiones
          </h3>
          {versions.length > 0 ? (
            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
              {versions.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
          aria-label="Cerrar versiones"
        >
          ×
        </button>
      </div>

      {/* Versions list */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <CollaborationSheetSkeleton aria-label="Cargando versiones del presupuesto" />
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--app-text-muted)]">
            Sin versiones guardadas aun
          </p>
        ) : (
          <div className="space-y-2">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  "rounded-lg border p-3",
                  index === 0
                    ? "border-sky-200 bg-sky-50/40"
                    : "border-[var(--app-border)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          index === 0
                            ? "bg-sky-600 text-white"
                            : "bg-slate-200 text-slate-600",
                        )}
                      >
                        v{version.versionNumber}
                      </span>
                      {version.label ? (
                        <span className="text-xs font-medium text-[var(--app-text-strong)]">
                          {version.label}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--app-text-muted)]">
                      <User className="h-3 w-3" />
                      <span>{version.createdByName}</span>
                      <span>·</span>
                      <span>{formatDate(version.createdAt)}</span>
                    </div>
                    {version.reason ? (
                      <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
                        {version.reason}
                      </p>
                    ) : null}
                  </div>

                  {showConfirmRestore === version.id ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            void handleRestore(version.id);
                          }}
                          disabled={restoringId === version.id}
                          className="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                        >
                          {restoringId === version.id ? "..." : "Restaurar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirmRestore(null)}
                          className="rounded-md px-2 py-1 text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="flex items-center gap-1 text-[9px] text-amber-600">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Crea nueva version, no borra historial
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmRestore(version.id)}
                      className="shrink-0 rounded-lg p-1.5 text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-sky-600"
                      title="Restaurar esta version"
                      aria-label={`Restaurar version ${version.versionNumber}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
