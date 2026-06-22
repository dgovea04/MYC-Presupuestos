"use client";

import { Badge } from "@/components/ui/badge";
import type { S10ImportDraftPreview, S10ImportDraftPreviewBudget } from "@/lib/s10/import-preview";

type ImportBudgetFooterPreviewProps = {
  preview: S10ImportDraftPreview;
  selectedBudgetId?: string | null;
};

export function ImportBudgetFooterPreview({ preview, selectedBudgetId }: ImportBudgetFooterPreviewProps) {
  const generalBudget = preview.budgets.find((budget) => budget.kind === "GENERAL") ?? null;
  const selectedBudget = selectedBudgetId ? preview.budgets.find((budget) => budget.id === selectedBudgetId) ?? null : null;
  const budgetsWithFooter = preview.budgets.filter((budget) => budget.footerRows.length > 0);
  const generalBudgetsWithFooter = budgetsWithFooter.filter((budget) => budget.kind === "GENERAL").length;
  const subBudgetsWithFooter = budgetsWithFooter.filter((budget) => budget.kind === "SUB_BUDGET").length;
  const subBudgets = preview.budgets.filter((budget) => budget.kind === "SUB_BUDGET");
  const subBudgetCount = subBudgets.length;
  const importedItemCount = subBudgets.reduce((sum, budget) => sum + budget.itemCount, 0);
  const importedApuCount = subBudgets.reduce((sum, budget) => sum + budget.apuCount, 0);
  const footerRowCount = budgetsWithFooter.reduce((sum, budget) => sum + budget.footerRows.length, 0);
  const visibleBudgets = uniqueBudgets([generalBudget, selectedBudget]).filter((budget) => budget.footerRows.length > 0);

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]">
      <div className="border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">Pie de presupuesto a importar</h3>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              {footerRowCount > 0
                ? `${footerRowCount} filas detectadas: ${formatBudgetScope(generalBudgetsWithFooter, subBudgetsWithFooter)}.`
                : "No se detectaron filas de pie en el archivo."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <FooterMetric label="GG" value={generalBudget ? formatRate(generalBudget.generalExpensesRate) : "-"} />
            <FooterMetric label="Utilidad" value={generalBudget ? formatRate(generalBudget.utilityRate) : "-"} />
            <FooterMetric label="IGV" value={generalBudget ? formatRate(generalBudget.igvRate) : "-"} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="bg-[var(--app-surface)] text-[var(--app-text-strong)]">1 presupuesto general</Badge>
          <Badge className="bg-[var(--app-surface)] text-[var(--app-text-strong)]">{formatCount(subBudgetCount, "subpresupuesto", "subpresupuestos")}</Badge>
          <Badge className="bg-[var(--app-surface)] text-[var(--app-text-strong)]">{formatCount(importedItemCount, "partida", "partidas")}</Badge>
          <Badge className="bg-[var(--app-surface)] text-[var(--app-text-strong)]">{importedApuCount} APUs</Badge>
          <Badge className="bg-[var(--app-surface)] text-[var(--app-text-strong)]">{preview.resourceCount} insumos</Badge>
        </div>
      </div>

      {visibleBudgets.length > 0 ? (
        <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {visibleBudgets.map((budget) => (
            <FooterBudgetTable key={budget.id} budget={budget} />
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-[var(--app-text-muted)]">Se importaran las partidas y APUs sin filas manuales de pie.</div>
      )}
    </section>
  );
}

function formatBudgetScope(generalBudgetCount: number, subBudgetCount: number) {
  const parts: string[] = [];

  if (generalBudgetCount > 0) {
    parts.push(formatCount(generalBudgetCount, "presupuesto general", "presupuestos generales"));
  }

  if (subBudgetCount > 0) {
    parts.push(formatCount(subBudgetCount, "subpresupuesto", "subpresupuestos"));
  }

  return parts.length > 0 ? parts.join(" y ") : "sin presupuestos con pie";
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function FooterBudgetTable({ budget }: { budget: S10ImportDraftPreviewBudget }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border-soft)] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{budget.name}</p>
          <p className="text-xs text-[var(--app-text-muted)]">{budget.kind === "GENERAL" ? "Presupuesto general" : "Subpresupuesto"}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Badge className="bg-sky-50 text-sky-700">GG {formatRate(budget.generalExpensesRate)}</Badge>
          <Badge className="bg-emerald-50 text-emerald-700">UT {formatRate(budget.utilityRate)}</Badge>
          <Badge className="bg-amber-50 text-amber-700">IGV {formatRate(budget.igvRate)}</Badge>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-[var(--app-surface)] text-xs uppercase text-[var(--app-text-muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">Variable</th>
              <th className="px-3 py-2 font-medium">Descripcion</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-border-soft)]">
            {budget.footerRows.map((row) => (
              <tr key={`${budget.id}-${row.variable}-${row.sortOrder}`} className={row.highlight ? "bg-[var(--app-surface-elevated)] text-[var(--app-text-strong)]" : "text-[var(--app-text-muted)]"}>
                <td className="whitespace-nowrap px-4 py-2 font-medium">{row.variable}</td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatMoney(row.manualValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FooterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 py-2">
      <p className="text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function uniqueBudgets(budgets: Array<S10ImportDraftPreviewBudget | null>) {
  const seen = new Set<string>();
  return budgets.filter((budget): budget is S10ImportDraftPreviewBudget => {
    if (!budget || seen.has(budget.id)) {
      return false;
    }

    seen.add(budget.id);
    return true;
  });
}

function formatRate(value: number) {
  return `${(value * 100).toLocaleString("es-PE", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  })}%`;
}

function formatMoney(value: number) {
  return value.toLocaleString("es-PE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
