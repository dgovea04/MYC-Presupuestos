"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  broadcastAppDataChange,
  getAppDataChangeEventName,
  getAppDataChangeStorageKey,
  type AppDataChangePayload,
} from "@/lib/client/live-updates";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { ActionButton } from "@/components/ui/action-button";
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
  const [error, setError] = useState("");
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
    setError("");

    const response = await fetch(`/api/budgets/${id}`, { method: "DELETE" });

    setPendingId(null);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo eliminar el presupuesto");
      return;
    }

    setBaseRows((current) => current.filter((budget) => budget.id !== id));
    broadcastAppDataChange(["/dashboard", "/projects", "/budgets"], undefined, { locallyHandledPaths: ["/budgets"] });
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
        <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 md:flex-row md:items-center md:justify-between dark:border-[rgba(37,99,235,0.28)] dark:bg-[rgba(37,99,235,0.12)] dark:text-[var(--app-primary-soft)]">
          <div>
            <p className="font-semibold text-sky-900 dark:text-[var(--app-text-strong)]">{templateIntent.label}</p>
            <p className="mt-1 text-sky-700 dark:text-[var(--app-text-muted)]">{templateIntent.description}</p>
          </div>
          <Link
            href="/templates?module=GENERAL_EXPENSES&source=WORKBOOK"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white px-3 py-2 font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 dark:border-[rgba(37,99,235,0.28)] dark:bg-[var(--app-surface)] dark:text-[var(--app-primary-soft)] dark:hover:bg-[var(--app-surface-hover)]"
          >
            Ver plantillas
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-[rgba(255,77,77,0.28)] dark:bg-[rgba(255,77,77,0.12)] dark:text-rose-300">
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
  const primaryHref = templateIntent
    ? `/budgets/${budget.id}/general-expenses?template=${encodeURIComponent(templateIntent.id)}`
    : `/budgets/${budget.id}`;

  return (
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
            disabled={isPending}
            onClick={() => void onRemoveBudget(budget.id)}
          />
        </div>
      </TD>
    </TR>
  );
});
