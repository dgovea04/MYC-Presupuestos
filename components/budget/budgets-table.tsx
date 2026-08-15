"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

import {
  broadcastAppDataChange,
  getAppDataChangeEventName,
  getAppDataChangeStorageKey,
  type AppDataChangePayload,
} from "@/lib/client/live-updates";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalFilterSummary, OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StaticTableFrame } from "@/components/ui/virtualized-table-frame";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DateFormatOption } from "@/types/settings";

type BudgetRow = {
  id: string;
  name: string;
  currency: string;
  totalAmount: number;
  updatedAt?: string | Date;
  projectName: string;
};

export type GeneralExpenseTemplateIntent = {
  id: "general-expenses-fixed-workbook" | "general-expenses-variable-workbook";
  label: string;
  description: string;
};

export function BudgetsTable({
  budgets,
  templateIntent = null,
}: {
  budgets: BudgetRow[];
  templateIntent?: GeneralExpenseTemplateIntent | null;
}) {
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const [baseRows, setBaseRows] = useState(budgets);
  const [optimisticBudgets, setOptimisticBudgets] = useState<Record<string, Partial<BudgetRow>>>({});
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error] = useState("");
  const deferredFilter = useDeferredValue(filter);

  useEffect(() => {
    function applyPayload(payload: AppDataChangePayload | null) {
      if (!payload?.budgets?.length) return;
      const matchingBudgets = payload.budgets;

      setOptimisticBudgets((current) => {
        const next = { ...current };

        for (const budget of matchingBudgets) {
          next[budget.id] = {
            ...next[budget.id],
            name: budget.name,
            currency: budget.currency,
            totalAmount: budget.totalAmount,
            updatedAt: budget.updatedAt,
          };
        }

        return next;
      });
    }

    function handleCustomEvent(event: Event) {
      applyPayload((event as CustomEvent<AppDataChangePayload>).detail);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== getAppDataChangeStorageKey() || !event.newValue) return;

      try {
        applyPayload(JSON.parse(event.newValue) as AppDataChangePayload);
      } catch {}
    }

    window.addEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const rows = useMemo(
    () =>
      baseRows.map((budget) => ({
        ...budget,
        ...optimisticBudgets[budget.id],
      })),
    [baseRows, optimisticBudgets],
  );

  const filtered = useMemo(
    () => rows.filter((budget) => `${budget.name} ${budget.projectName}`.toLowerCase().includes(deferredFilter.toLowerCase())),
    [deferredFilter, rows],
  );

  const removeBudget = useCallback(async (id: string) => {
    setPendingId(id);

    try {
      const response = await fetch(`/api/budgets/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo eliminar el presupuesto");
      }

      setBaseRows((current) => current.filter((budget) => budget.id !== id));
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets"], undefined, { locallyHandledPaths: ["/budgets"] });
    } finally {
      setPendingId(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      <OperationalPanel
        title="Tabla operativa"
        description={
          templateIntent
            ? "Selecciona un presupuesto general para abrir el desagregado correspondiente a la plantilla elegida."
            : "Busca por presupuesto o proyecto y entra rapido a revisar o depurar la cartera activa."
        }
        metrics={
          <div className="flex flex-wrap items-center gap-2">
            <OperationalMetricBadge tone="accent">
              {filtered.length} {filtered.length === 1 ? "presupuesto" : "presupuestos"}
            </OperationalMetricBadge>
            <OperationalMetricBadge>{rows.length} total</OperationalMetricBadge>
          </div>
        }
        controls={
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Input placeholder="Buscar por presupuesto o proyecto" value={filter} onChange={(event) => setFilter(event.target.value)} />
            <OperationalFilterSummary className="flex items-center">
              {filter.trim() ? `Mostrando ${filtered.length} coincidencias para "${filter}"` : "Vista general de presupuestos disponibles"}
            </OperationalFilterSummary>
          </div>
        }
      />

      {templateIntent ? (
        <div className="theme-status-info flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="theme-status-info-strong font-semibold">{templateIntent.label}</p>
            <p className="mt-1">{templateIntent.description}</p>
          </div>
          <Link
            href="/templates?module=GENERAL_EXPENSES&source=WORKBOOK"
            className="theme-status-link-info inline-flex shrink-0 items-center justify-center rounded-xl border px-3 py-2 font-medium transition"
          >
            Ver plantillas
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="theme-status-error rounded-2xl border px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}
      <StaticTableFrame>
        <Table>
          <THead className="[&_tr]:border-b-[var(--app-border)]">
            <TR className="bg-[var(--app-surface-elevated)] hover:bg-[var(--app-surface-elevated)]">
              <TH>Presupuesto</TH>
              <TH>Proyecto</TH>
              <TH>Total</TH>
              <TH>Actualizado</TH>
              <TH className="text-right">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length > 0 ? (
              filtered.map((budget) => (
                <BudgetTableRow
                  key={budget.id}
                  budget={budget}
                  currencyDecimals={currencyDecimals}
                  dateFormat={dateFormat}
                  isPending={pendingId === budget.id}
                  templateIntent={templateIntent}
                  onRemoveBudget={removeBudget}
                />
              ))
            ) : (
              <TR>
                <TD colSpan={5} className="px-6 py-10 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--app-text-strong)]">No encontramos presupuestos con ese filtro</p>
                    <p className="text-sm text-[var(--app-text-muted)]">Prueba otro termino de busqueda o crea un presupuesto nuevo para comenzar.</p>
                  </div>
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </StaticTableFrame>
    </div>
  );
}

const BudgetTableRow = memo(function BudgetTableRow({
  budget,
  currencyDecimals,
  dateFormat,
  isPending,
  templateIntent,
  onRemoveBudget,
}: {
  budget: BudgetRow;
  currencyDecimals: number;
  dateFormat: DateFormatOption;
  isPending: boolean;
  templateIntent: GeneralExpenseTemplateIntent | null;
  onRemoveBudget: (id: string) => Promise<void>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await onRemoveBudget(budget.id);
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar el presupuesto");
    } finally {
      setIsDeleting(false);
    }
  }

  const primaryHref = templateIntent
    ? `/budgets/${budget.id}/general-expenses?template=${encodeURIComponent(templateIntent.id)}`
    : `/budgets/${budget.id}`;

  return (
    <>
      <TR className="hover:bg-[var(--app-surface-muted)]/80">
        <TD className="font-medium text-[var(--app-text-strong)]">{budget.name}</TD>
        <TD>{budget.projectName}</TD>
        <TD>{formatCurrency(budget.totalAmount, budget.currency, currencyDecimals)}</TD>
        <TD>{formatDate(budget.updatedAt, dateFormat)}</TD>
        <TD>
          <div className="flex justify-end gap-2">
            <Link href={primaryHref}>
              <ActionButton action="open" label={templateIntent ? "Gastos generales" : "Abrir"} size="sm" variant="outline" />
            </Link>
            {templateIntent ? (
              <Link href={`/budgets/${budget.id}`}>
                <ActionButton action="open" label="Presupuesto" size="sm" variant="ghost" />
              </Link>
            ) : null}
            <ActionButton
              action="delete"
              label="Eliminar"
              size="sm"
              variant="ghost"
              disabled={isPending || isDeleting}
              data-budget-action="delete"
              data-budget-id={budget.id}
              onClick={() => setDeleteOpen(true)}
            />
          </div>
        </TD>
      </TR>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">
                  Eliminar presupuesto
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                  Se eliminara <span className="font-medium text-[var(--app-text)]">{budget.name}</span> junto con sus partidas,
                  APU, insumos y datos asociados.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Esta accion no se puede deshacer. Se eliminaran todos los datos del presupuesto de forma permanente.
              </p>
            </div>

            {deleteError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={isDeleting}>
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar presupuesto
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
});
