"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  broadcastAppDataChange,
  getAppDataChangeEventName,
  getAppDataChangeStorageKey,
  type AppDataChangePayload,
} from "@/lib/client/live-updates";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

type BudgetRow = {
  id: string;
  name: string;
  currency: string;
  totalAmount: number;
  updatedAt?: string | Date;
  projectName: string;
};

export function BudgetsTable({ budgets }: { budgets: BudgetRow[] }) {
  const router = useRouter();
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const [optimisticBudgets, setOptimisticBudgets] = useState<Record<string, Partial<BudgetRow>>>({});
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
      budgets.map((budget) => ({
        ...budget,
        ...optimisticBudgets[budget.id],
      })),
    [budgets, optimisticBudgets],
  );

  const filtered = useMemo(
    () => rows.filter((budget) => `${budget.name} ${budget.projectName}`.toLowerCase().includes(filter.toLowerCase())),
    [rows, filter],
  );

  async function removeBudget(id: string) {
    setPendingId(id);
    setError("");

    const response = await fetch(`/api/budgets/${id}`, { method: "DELETE" });

    setPendingId(null);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo eliminar el presupuesto");
      return;
    }

    broadcastAppDataChange(["/dashboard", "/projects", "/budgets"]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Input placeholder="Buscar por presupuesto o proyecto" value={filter} onChange={(event) => setFilter(event.target.value)} />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <Table>
          <THead>
            <TR className="bg-slate-50 hover:bg-slate-50">
              <TH>Presupuesto</TH>
              <TH>Proyecto</TH>
              <TH>Total</TH>
              <TH>Actualizado</TH>
              <TH className="text-right">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((budget) => (
              <TR key={budget.id}>
                <TD className="font-medium text-slate-900">{budget.name}</TD>
                <TD>{budget.projectName}</TD>
                <TD>{formatCurrency(budget.totalAmount, budget.currency, currencyDecimals)}</TD>
                <TD>{formatDate(budget.updatedAt, dateFormat)}</TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    <Link href={`/budgets/${budget.id}`}>
                      <ActionButton action="open" label="Abrir" size="sm" variant="outline" />
                    </Link>
                    <ActionButton
                      action="delete"
                      label="Eliminar"
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === budget.id}
                      onClick={() => removeBudget(budget.id)}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
