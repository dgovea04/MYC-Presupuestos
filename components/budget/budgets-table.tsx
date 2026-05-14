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
import { OperationalPanel } from "@/components/ui/operational-surfaces";
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
      <OperationalPanel
        title="Tabla operativa"
        description="Busca por presupuesto o proyecto y entra rápido a revisar o depurar la cartera activa."
        metrics={
          <>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
              {filtered.length} {filtered.length === 1 ? "presupuesto" : "presupuestos"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
              {rows.length} total
            </span>
          </>
        }
        controls={
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              placeholder="Buscar por presupuesto o proyecto"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="lg:max-w-xl"
            />
            <p className="text-sm text-slate-500">
              {filter.trim() ? `Mostrando ${filtered.length} coincidencias para "${filter}"` : "Vista general de presupuestos disponibles"}
            </p>
          </div>
        }
      />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Table>
          <THead className="[&_tr]:border-b-slate-200">
            <TR className="bg-slate-50 hover:bg-slate-50">
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
                <TR key={budget.id} className="hover:bg-slate-50/80">
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
              ))
            ) : (
              <TR>
                <TD colSpan={5} className="px-6 py-10 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">No encontramos presupuestos con ese filtro</p>
                    <p className="text-sm text-slate-500">Prueba otro término de búsqueda o crea un presupuesto nuevo para comenzar.</p>
                  </div>
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
