"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { ResourceOverallocation } from "@/lib/work-schedule/resource-capacity";

export type ResourceCapacityPanelProps = {
  overallocations: ResourceOverallocation[];
};

export function ResourceCapacityPanel({ overallocations }: ResourceCapacityPanelProps) {
  const [filter, setFilter] = useState<"all" | "overallocated">("all");

  const grouped = useMemo(() => {
    const map = new Map<string, ResourceOverallocation[]>();
    for (const item of overallocations) {
      const existing = map.get(item.resourceId) ?? [];
      existing.push(item);
      map.set(item.resourceId, existing);
    }
    return map;
  }, [overallocations]);

  const visibleOverallocations = useMemo(() => {
    if (filter === "all") return overallocations;
    return overallocations;
  }, [filter, overallocations]);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">Alertas de capacidad</p>
            <p className="text-xs text-[var(--app-text-muted)]">
              Deteccion de sobreasignacion de recursos por periodo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              Todos
            </Button>
            <Button
              variant={filter === "overallocated" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("overallocated")}
            >
              Solo sobreasignados
            </Button>
          </div>
        </div>

        {visibleOverallocations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 text-sm text-[var(--app-text-muted)]">
            No se detectan sobreasignaciones.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--app-border)]">
            <Table className="table-fixed">
              <THead className="bg-[var(--app-surface-muted)]">
                <TR>
                  <TH className="text-left">Recurso</TH>
                  <TH className="text-left">Periodo</TH>
                  <TH className="text-right">Demanda</TH>
                  <TH className="text-right">Capacidad</TH>
                  <TH className="text-right">Exceso</TH>
                </TR>
              </THead>
              <TBody>
                {Array.from(grouped.entries()).map(([resourceId, items]) =>
                  items.map((item, index) => (
                    <TR key={`${resourceId}-${item.periodKey}`}>
                      {index === 0 ? (
                        <TD className="text-sm font-medium text-[var(--app-text-strong)]" rowSpan={items.length}>
                          {item.resourceName}
                        </TD>
                      ) : null}
                      <TD className="text-sm text-[var(--app-text-muted)]">{item.periodKey}</TD>
                      <TD className="text-right text-sm text-[var(--app-text-strong)]">
                        {item.demandQuantity.toFixed(2)}
                      </TD>
                      <TD className="text-right text-sm text-[var(--app-text-muted)]">
                        {item.capacityQuantity.toFixed(2)}
                      </TD>
                      <TD className="text-right text-sm font-semibold text-rose-600">
                        {item.excessQuantity.toFixed(2)}
                      </TD>
                    </TR>
                  )),
                )}
              </TBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
