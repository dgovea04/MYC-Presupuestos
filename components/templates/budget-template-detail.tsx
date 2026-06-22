import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Clock3, FileSpreadsheet, Layers3, ListTree } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { formatCurrency } from "@/lib/utils";
import type { UserBudgetTemplateRecord } from "@/lib/data/budget-templates";

export function BudgetTemplateDetail({
  sourceProjectName,
  template,
  currencyDecimals,
}: {
  sourceProjectName?: string | null;
  template: UserBudgetTemplateRecord;
  currencyDecimals: number;
}) {
  const { snapshot } = template;
  const previewItems = snapshot.items.slice(0, 8);
  const previewLevels = snapshot.levels.slice(0, 9);
  const hiddenItemCount = Math.max(snapshot.items.length - previewItems.length, 0);
  const hiddenLevelCount = Math.max(snapshot.levels.length - previewLevels.length, 0);
  const preparation = getTemplatePreparationSummary(template);

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

      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <PreparationMetric
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-700" />}
            label="Preparacion"
            value={preparation.statusLabel}
            detail={preparation.statusDetail}
          />
          <PreparationMetric
            icon={<Layers3 className="h-4 w-4 text-sky-700" />}
            label="Cobertura APU"
            value={preparation.apuCoverageLabel}
            detail={preparation.apuCoverageDetail}
          />
          <PreparationMetric
            icon={<Clock3 className="h-4 w-4 text-slate-500" />}
            label="Actualizada"
            value={formatSnapshotDate(template.updatedAt)}
            detail={`Capturada ${formatSnapshotDate(snapshot.source.capturedAt)}`}
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-5 w-5 text-sky-700" />
              Origen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <DetailRow
              label="Proyecto fuente"
              value={
                sourceProjectName && template.sourceProjectId ? (
                  <Link
                    href={`/projects/${template.sourceProjectId}`}
                    className="text-sky-700 transition hover:text-sky-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {sourceProjectName}
                  </Link>
                ) : (
                  "No disponible"
                )
              }
            />
            <DetailRow
              label="Presupuesto fuente"
              value={
                template.sourceBudgetId ? (
                  <Link
                    href={`/budgets/${template.sourceBudgetId}`}
                    className="text-sky-700 transition hover:text-sky-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {snapshot.source.budgetName}
                  </Link>
                ) : (
                  snapshot.source.budgetName
                )
              }
            />
            <DetailRow label="Capturado" value={formatSnapshotDate(snapshot.source.capturedAt)} />
            <DetailRow label="Tipo" value={snapshot.budget.kind === "GENERAL" ? "Presupuesto general" : "Subpresupuesto"} />
            <DetailRow label="Costo directo" value={formatCurrency(snapshot.summary.totalDirectCost, snapshot.summary.currency, currencyDecimals)} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge className="bg-[color:rgba(16,185,129,0.16)] text-emerald-700">Usuario</Badge>
              <Badge>Version {snapshot.schemaVersion}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-5 w-5 text-sky-700" />
              Partidas de referencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewItems.length ? (
              <div className="space-y-3">
                <PreviewCount
                  hiddenCount={hiddenItemCount}
                  label="partidas"
                  visibleCount={previewItems.length}
                  totalCount={snapshot.items.length}
                />
                <div className="overflow-hidden rounded-2xl border border-[var(--app-border)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--app-surface-muted)] text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Codigo</th>
                        <th className="px-3 py-2">Partida</th>
                        <th className="px-3 py-2">Unidad</th>
                        <th className="px-3 py-2 text-right">Parcial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border-soft)]">
                      {previewItems.map((item) => (
                        <tr key={item.templateKey}>
                          <td className="px-3 py-2 font-medium text-[var(--app-text-strong)]">{item.code}</td>
                          <td className="px-3 py-2 text-[var(--app-text)]">{item.description}</td>
                          <td className="px-3 py-2 text-[var(--app-text-muted)]">{item.unit}</td>
                          <td className="px-3 py-2 text-right text-[var(--app-text)]">
                            {formatCurrency(item.partial, snapshot.summary.currency, currencyDecimals)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-5 text-sm text-[var(--app-text-muted)]">
                Esta plantilla no contiene partidas guardadas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-sky-700" />
            Estructura capturada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {previewLevels.length ? (
            <PreviewCount
              hiddenCount={hiddenLevelCount}
              label="niveles"
              visibleCount={previewLevels.length}
              totalCount={snapshot.levels.length}
            />
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {previewLevels.map((level) => (
              <div key={level.templateKey} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-subtle)]">{level.type}</p>
                <p className="mt-1 font-medium text-[var(--app-text-strong)]">{level.code} {level.name}</p>
              </div>
            ))}
            {!snapshot.levels.length ? (
              <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-5 text-sm text-[var(--app-text-muted)]">
                Sin niveles jerarquicos.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
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

function PreviewCount({
  hiddenCount,
  label,
  totalCount,
  visibleCount,
}: {
  hiddenCount: number;
  label: string;
  totalCount: number;
  visibleCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-[var(--app-text-muted)]">
        Mostrando {visibleCount} de {totalCount} {label}
      </span>
      {hiddenCount > 0 ? <Badge>+{hiddenCount} {label} adicionales</Badge> : null}
    </div>
  );
}

function PreparationMetric({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-[var(--app-text-muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-semibold text-[var(--app-text-strong)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--app-text-muted)]">{detail}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border-soft)] pb-3 last:border-0 last:pb-0">
      <span className="text-[var(--app-text-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--app-text-strong)]">{value}</span>
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

function getTemplatePreparationSummary(template: UserBudgetTemplateRecord) {
  const { snapshot } = template;
  const itemCount = snapshot.summary.itemCount;
  const apuCount = snapshot.summary.apuCount;
  const hasItems = itemCount > 0;
  const hasCompleteApuCoverage = hasItems && apuCount === itemCount;

  return {
    statusLabel: hasItems ? "Lista para aplicar" : "Sin partidas",
    statusDetail: hasItems
      ? `${formatTemplateQuantity(itemCount, "partida")} listas para crear presupuesto.`
      : "Agrega partidas antes de usar esta plantilla.",
    apuCoverageLabel: `${apuCount} de ${itemCount} partidas`,
    apuCoverageDetail: hasCompleteApuCoverage ? "Todas las partidas incluyen APU." : "Revisa o completa APU luego de aplicar.",
  };
}

function formatTemplateQuantity(count: number, singularLabel: string) {
  return `${count} ${count === 1 ? singularLabel : `${singularLabel}s`}`;
}
