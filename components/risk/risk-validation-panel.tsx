import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";

export function RiskValidationPanel({ items, variables }: { items: RiskBudgetItem[]; variables: RiskVariableRecord[] }) {
  const itemIds = new Set(items.map((item) => item.itemId));
  const issues = [
    ...items.filter((item) => item.baseQuantity <= 0).map((item) => `${item.code || "Partida"} sin cantidad base positiva.`),
    ...items.filter((item) => item.unitPrice <= 0).map((item) => `${item.code || "Partida"} sin precio unitario positivo.`),
    ...variables
      .filter((variable) => variable.minimum > variable.mostLikely || variable.mostLikely > variable.maximum)
      .map((variable) => `${getItemLabel(variable.budgetItemId, items)} no cumple Min <= Probable <= Max.`),
    ...variables
      .filter((variable) => !itemIds.has(variable.budgetItemId))
      .map((variable) => `Variable ${variable.id} apunta a una partida fuera del alcance.`),
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Control de calidad</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Variables listas para simulacion.
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div
                key={`${issue}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getItemLabel(itemId: string, items: RiskBudgetItem[]) {
  const item = items.find((candidate) => candidate.itemId === itemId);
  return item?.code || item?.description || "Una variable";
}
