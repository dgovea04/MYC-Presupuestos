import { BookOpenCheck, FileSpreadsheet, Layers3, ListTree } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { formatCurrency } from "@/lib/utils";
import type { UserBudgetTemplateRecord } from "@/lib/data/budget-templates";

export function BudgetTemplateDetail({
  template,
  currencyDecimals,
}: {
  template: UserBudgetTemplateRecord;
  currencyDecimals: number;
}) {
  const { snapshot } = template;
  const previewItems = snapshot.items.slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InfoCard label="Partidas" value={String(snapshot.summary.itemCount)} tone="sky" />
        <InfoCard label="Niveles" value={String(snapshot.summary.levelCount)} tone="slate" />
        <InfoCard label="APU" value={String(snapshot.summary.apuCount)} tone="amber" />
        <InfoCard label="Moneda" value={snapshot.summary.currency} tone="slate" />
        <InfoCard
          label="Total origen"
          value={formatCurrency(snapshot.summary.totalAmount, snapshot.summary.currency, currencyDecimals)}
          tone="emerald"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-5 w-5 text-sky-700" />
              Origen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <DetailRow label="Presupuesto fuente" value={snapshot.source.budgetName} />
            <DetailRow label="Capturado" value={formatSnapshotDate(snapshot.source.capturedAt)} />
            <DetailRow label="Tipo" value={snapshot.budget.kind === "GENERAL" ? "Presupuesto general" : "Subpresupuesto"} />
            <DetailRow label="Costo directo" value={formatCurrency(snapshot.summary.totalDirectCost, snapshot.summary.currency, currencyDecimals)} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge className="bg-emerald-100 text-emerald-800">Usuario</Badge>
              <Badge className="bg-slate-100 text-slate-700">Version {snapshot.schemaVersion}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-5 w-5 text-sky-700" />
              Partidas de referencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewItems.length ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Partida</th>
                      <th className="px-3 py-2">Unidad</th>
                      <th className="px-3 py-2 text-right">Parcial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.map((item) => (
                      <tr key={item.templateKey}>
                        <td className="px-3 py-2 font-medium text-slate-800">{item.code}</td>
                        <td className="px-3 py-2 text-slate-600">{item.description}</td>
                        <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {formatCurrency(item.partial, snapshot.summary.currency, currencyDecimals)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Esta plantilla no contiene partidas guardadas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-sky-700" />
            Estructura capturada
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.levels.slice(0, 9).map((level) => (
            <div key={level.templateKey} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{level.type}</p>
              <p className="mt-1 font-medium text-slate-900">{level.code} {level.name}</p>
            </div>
          ))}
          {!snapshot.levels.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Sin niveles jerarquicos.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-5 w-5 text-sky-700" />
            Tasas base
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoCard label="IGV" value={`${formatRate(snapshot.budget.igvRate)}%`} tone="slate" />
          <InfoCard label="Gastos generales" value={`${formatRate(snapshot.budget.generalExpensesRate)}%`} tone="slate" />
          <InfoCard label="Utilidad" value={`${formatRate(snapshot.budget.utilityRate)}%`} tone="slate" />
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRate(value: number) {
  return (value * 100).toFixed(2).replace(/\.?0+$/, "");
}
