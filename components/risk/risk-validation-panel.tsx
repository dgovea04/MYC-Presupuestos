"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";

export function RiskValidationPanel({
  collapsed,
  items,
  onToggleCollapsed,
  variables,
}: {
  collapsed: boolean;
  items: RiskBudgetItem[];
  onToggleCollapsed: () => void;
  variables: RiskVariableRecord[];
}) {
  const itemIds = new Set(items.map((item) => item.itemId));
  const issues = [
    ...items.filter((item) => item.baseQuantity <= 0).map((item) => `${item.code || "Partida"} sin cantidad base positiva.`),
    ...items.filter((item) => item.unitPrice <= 0).map((item) => `${item.code || "Partida"} sin precio unitario positivo.`),
    ...variables
      .filter((variable) => variable.minimum > variable.mostLikely || variable.mostLikely > variable.maximum)
      .map((variable) => `${getVariableLabel(variable, items)} no cumple Min <= Probable <= Max.`),
    ...variables
      .filter((variable) => !itemIds.has(variable.budgetItemId))
      .map((variable) => `Variable ${variable.id} apunta a una partida fuera del alcance.`),
  ];

  return (
    <Card
      data-collapsed={collapsed ? "true" : "false"}
      data-testid="risk-validation-panel"
      className="theme-surface-card h-fit overflow-hidden"
    >
      <CardHeader className={collapsed ? "flex flex-row items-center justify-center px-2 py-3" : "flex flex-row items-center justify-between px-5 py-3"}>
        {!collapsed ? <CardTitle className="text-base">Control de calidad</CardTitle> : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={collapsed ? "Expandir control de calidad" : "Colapsar control de calidad"}
          title={collapsed ? "Expandir control de calidad" : "Colapsar control de calidad"}
          className="h-8 w-8 px-0"
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {!collapsed ? (
        <CardContent className="p-5">
          {issues.length === 0 ? (
            <div className="theme-status-success theme-status-success-strong flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Variables listas para simulacion.
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, index) => (
                <div
                  key={`${issue}-${index}`}
                  className="theme-status-warning theme-status-warning-strong flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function getItemLabel(itemId: string, items: RiskBudgetItem[]) {
  const item = items.find((candidate) => candidate.itemId === itemId);
  return item?.code || item?.description || "Una variable";
}

function getVariableLabel(variable: RiskVariableRecord, items: RiskBudgetItem[]) {
  const itemLabel = getItemLabel(variable.budgetItemId, items);
  return `${itemLabel} (${getVariableTypeLabel(variable.variableType)})`;
}

function getVariableTypeLabel(variableType: RiskVariableRecord["variableType"]) {
  if (variableType === "UNIT_PRICE") {
    return "precio unitario";
  }

  if (variableType === "DURATION") {
    return "duracion";
  }

  return "cantidad";
}
