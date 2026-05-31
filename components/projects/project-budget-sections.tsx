"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedCurrencyValue } from "@/components/ui/animated-currency-value";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import {
  getAppDataChangeEventName,
  getAppDataChangeStorageKey,
  type AppDataChangePayload,
  type BudgetLiveUpdateSummary,
} from "@/lib/client/live-updates";
import { formatDate } from "@/lib/utils";

type BudgetSectionSummary = BudgetLiveUpdateSummary;

export function ProjectBudgetSections({
  projectId,
  generalBudget,
  subBudgets,
}: {
  projectId: string;
  generalBudget: BudgetSectionSummary | null;
  subBudgets: BudgetSectionSummary[];
}) {
  const [optimisticBudgets, setOptimisticBudgets] = useState<Record<string, BudgetSectionSummary>>({});
  const { defaultSubBudgetNames, dateFormat } = useFormattingSettings();

  useEffect(() => {
    function applyPayload(payload: AppDataChangePayload | null) {
      if (!payload?.budgets?.length) return;

      const matchingBudgets = payload.budgets.filter((budget) => budget.projectId === projectId);
      if (!matchingBudgets.length) return;

      setOptimisticBudgets((current) => {
        const next = { ...current };
        for (const budget of matchingBudgets) {
          next[budget.id] = budget;
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
  }, [projectId]);

  const general = generalBudget ? optimisticBudgets[generalBudget.id] ?? generalBudget : null;
  const subs = useMemo(
    () => subBudgets.map((budget) => optimisticBudgets[budget.id] ?? budget),
    [subBudgets, optimisticBudgets],
  );

  const orderedSubBudgets = useMemo(() => {
    const orderedByDefaultNames = defaultSubBudgetNames
      .map((name) => subs.find((budget) => budget.name === name))
      .filter((budget): budget is BudgetSectionSummary => Boolean(budget));
    const remaining = subs.filter((budget) => !defaultSubBudgetNames.includes(budget.name));

    return [...orderedByDefaultNames, ...remaining];
  }, [subs, defaultSubBudgetNames]);

  const consolidatedTotal = orderedSubBudgets.reduce((sum, budget) => sum + budget.totalAmount, 0);
  const budgetCurrency = general?.currency ?? orderedSubBudgets[0]?.currency ?? "PEN";
  const generalBudgetUpdatedAt =
    orderedSubBudgets
      .map((budget) => new Date(budget.updatedAt))
      .sort((left, right) => right.getTime() - left.getTime())[0]
      ?.toISOString() ?? general?.updatedAt;

  return (
    <>
      <section id="presupuesto-general">
        <Card className="border-slate-200">
          <CardContent className="space-y-4 p-6">
            <OperationalPanel
              title="Presupuesto general"
              description="Presupuesto padre del proyecto, pensado para consolidar el total general y abrir sus componentes."
            />

            {general ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-slate-900">Presupuesto General</p>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      Total consolidado:
                      <AnimatedCurrencyValue value={consolidatedTotal} currency={budgetCurrency} className="px-0 py-0 font-semibold text-slate-900" />
                    </span>
                    <span>Sub Presupuestos: {orderedSubBudgets.length}</span>
                    <span>Ultima actualizacion: {formatDate(generalBudgetUpdatedAt, dateFormat)}</span>
                  </div>
                </div>
                <Link href={`/budgets/${general.id}`}>
                  <ActionButton action="open" label="Abrir editor" />
                </Link>
              </div>
            ) : (
              <EmptyStatePanel message="Crea el presupuesto general para consolidar el total del proyecto y abrir sus secciones tecnicas." />
            )}
          </CardContent>
        </Card>
      </section>

      <section id="subpresupuestos">
        <Card className="border-slate-200">
          <CardContent className="space-y-4 p-6">
            <OperationalPanel
              title="Sub Presupuestos"
              description="Cada proyecto arranca con los Sub Presupuestos base configurados, listos para editar cada Sub Presupuesto."
              metrics={<OperationalMetricBadge tone="accent">{orderedSubBudgets.length} Sub Presupuestos</OperationalMetricBadge>}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {orderedSubBudgets.length ? (
                orderedSubBudgets.map((budget) => (
                  <div key={budget.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{budget.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                          Total actual:
                          <AnimatedCurrencyValue value={budget.totalAmount} currency={budget.currency} className="px-0 py-0 font-medium text-slate-700" />
                        </p>
                      </div>
                      <Badge className="bg-slate-200 text-slate-700">Sub Presupuesto</Badge>
                    </div>
                    <div className="mt-4">
                      <Link href={`/budgets/${budget.id}`}>
                        <ActionButton action="open" label="Abrir Sub Presupuesto" variant="outline" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyStatePanel message="Configura Sub Presupuestos para separar estructuras, arquitectura e instalaciones por paquete de trabajo." className="lg:col-span-2" />
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
