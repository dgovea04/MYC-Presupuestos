import type { AiSuggestionFeedbackProviderQuality, FeedbackTrendPoint } from "@/lib/ai/suggestion-feedback";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BotMessageSquare } from "lucide-react";

export type FeedbackSummary = {
  applied: number;
  edited: number;
  dismissed: number;
  total: number;
  acceptanceRate: string;
  editRate: string;
  discardRate: string;
  providerQuality: AiSuggestionFeedbackProviderQuality[];
};

export type { FeedbackTrendPoint };

export function QualityMetricsHeader({ total }: { total: number }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="dashboard-khipu-header-icon inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--khipu-blue)] text-white">
            <BotMessageSquare className="h-4 w-4" />
          </span>
          <p className="text-lg font-semibold text-slate-900">Calidad de Khipu</p>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Métricas de calidad basadas en el feedback de tus sugerencias de IA.
        </p>
      </div>
      <div className="dashboard-khipu-header-pill flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        {total} {total === 1 ? "sugerencia evaluada" : "sugerencias evaluadas"}
      </div>
    </div>
  );
}

export function QualityMetricsGrid({ summary }: { summary: FeedbackSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <QualityMetricCard
        label="Tasa de aceptación"
        value={formatPercent(summary.acceptanceRate)}
        tone={rateTone(Number(summary.acceptanceRate))}
        subtitle={summary.applied === 1 ? "1 sugerencia aplicada" : `${summary.applied} sugerencias aplicadas`}
      />
      <QualityMetricCard
        label="Aplicadas"
        value={String(summary.applied)}
        tone="emerald"
        subtitle={formatPercent(summary.acceptanceRate)}
      />
      <QualityMetricCard
        label="Editadas"
        value={String(summary.edited)}
        tone="sky"
        subtitle={formatPercent(summary.editRate)}
      />
      <QualityMetricCard
        label="Descartadas"
        value={String(summary.dismissed)}
        tone={summary.dismissed > 0 ? "rose" : "slate"}
        subtitle={formatPercent(summary.discardRate)}
      />
    </div>
  );
}

export function QualityMetricCard({
  label,
  value,
  tone,
  subtitle,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "rose" | "slate" | "amber";
  subtitle: string;
}) {
  const tones = {
    emerald: { value: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    sky: { value: "text-sky-700", bg: "bg-sky-50 border-sky-200" },
    rose: { value: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    slate: { value: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
    amber: { value: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  };

  return (
    <div className={cn(`dashboard-khipu-metric dashboard-khipu-metric-${tone} rounded-2xl border px-4 py-3`, tones[tone].bg)}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight", tones[tone].value)}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

export function AcceptanceBar({ summary }: { summary: FeedbackSummary }) {
  return (
    <div className="dashboard-khipu-acceptance overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 sm:grid-cols-3">
        <AcceptanceBarSegment
          label="Aplicadas"
          count={summary.applied}
          total={summary.total}
          className="bg-emerald-500"
          barClassName="bg-emerald-50"
        />
        <AcceptanceBarSegment
          label="Editadas"
          count={summary.edited}
          total={summary.total}
          className="bg-sky-500"
          barClassName="bg-sky-50"
        />
        <AcceptanceBarSegment
          label="Descartadas"
          count={summary.dismissed}
          total={summary.total}
          className="bg-rose-400"
          barClassName="bg-rose-50"
        />
      </div>
      <div className="flex h-2 w-full overflow-hidden bg-slate-100">
        {summary.applied > 0 ? (
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(summary.applied / summary.total) * 100}%` }}
          />
        ) : null}
        {summary.edited > 0 ? (
          <div
            className="h-full bg-sky-500 transition-all"
            style={{ width: `${(summary.edited / summary.total) * 100}%` }}
          />
        ) : null}
        {summary.dismissed > 0 ? (
          <div
            className="h-full bg-rose-400 transition-all"
            style={{ width: `${(summary.dismissed / summary.total) * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function AcceptanceBarSegment({
  label,
  count,
  total,
  className,
  barClassName,
}: {
  label: string;
  count: number;
  total: number;
  className: string;
  barClassName: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className={cn("dashboard-khipu-acceptance-segment border-r border-slate-100 px-4 py-3 last:border-r-0", barClassName)}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-lg font-semibold", className.replace("bg-", "text-"))}>{pct}%</span>
        <span className="text-xs text-slate-400">({count}/{total})</span>
      </p>
    </div>
  );
}

export function QualityMetricsEmpty() {
  return (
    <Card className="dashboard-khipu-empty border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.9)_100%)]">
      <CardContent className="px-4 py-6 text-center text-sm text-slate-500">
        <BotMessageSquare className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 font-medium text-slate-900">Sin datos de calidad</p>
        <p className="mt-1">
          Las métricas aparecerán cuando los usuarios comiencen a calificar las sugerencias de Khipu como
          aplicadas, editadas o descartadas.
        </p>
      </CardContent>
    </Card>
  );
}

export function ProviderQualityTable({ providers }: { providers: AiSuggestionFeedbackProviderQuality[] }) {
  return (
    <Card className="dashboard-khipu-provider-table border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Calidad por proveedor</p>
          <p className="mt-1 text-sm text-slate-500">
            Comparativa de aceptación entre los proveedores de IA utilizados.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="pb-2 pr-4">Proveedor</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Aplicadas</th>
                <th className="pb-2 pr-4 text-right">Editadas</th>
                <th className="pb-2 pr-4 text-right">Descartadas</th>
                <th className="pb-2 text-right">Aceptación</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <ProviderQualityRow key={provider.provider} provider={provider} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderQualityRow({ provider }: { provider: AiSuggestionFeedbackProviderQuality }) {
  const acceptancePct = Number(provider.acceptanceRate) * 100;
  const barWidth = Math.min(acceptancePct, 100);

  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="py-3 pr-4">
        <span className="font-medium text-slate-900">{provider.provider}</span>
      </td>
      <td className="py-3 pr-4 text-right text-slate-700">{provider.total}</td>
      <td className="py-3 pr-4 text-right text-emerald-700">{provider.applied}</td>
      <td className="py-3 pr-4 text-right text-sky-700">{provider.edited}</td>
      <td className="py-3 pr-4 text-right text-rose-600">{provider.dismissed}</td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                barWidth >= 60 ? "bg-emerald-500" : barWidth >= 30 ? "bg-amber-400" : "bg-rose-400",
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-semibold text-slate-600">
            {acceptancePct.toFixed(0)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

export function formatPercent(rate: string): string {
  const num = Number(rate);
  return `${(num * 100).toFixed(1)}%`;
}

export function rateTone(rate: number): "emerald" | "amber" | "rose" {
  if (rate >= 0.6) return "emerald";
  if (rate >= 0.3) return "amber";
  return "rose";
}
