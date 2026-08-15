import { CreditCard, DollarSign, UserMinus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import type { AdminMarketingMonetization } from "@/lib/data/admin-marketing-monetization";

type AdminMarketingMonetizationProps = {
  monetization: AdminMarketingMonetization;
};

export function AdminMarketingMonetization({ monetization }: AdminMarketingMonetizationProps) {
  const { metrics, rates } = monetization;

  return (
    <section aria-label="Monetización" className="space-y-6">
      <Card className="theme-surface-card">
        <CardContent className="space-y-5 p-6">
          <OperationalSectionHeader
            title="Monetización"
            description="Conversión a Pro y estado de suscripciones según BillingSubscription. Las cancelaciones se cuentan por cambios registrados dentro del rango seleccionado."
          />

          {!monetization.available ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              La fuente de monetización aún no está disponible.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactStatCard label="Activated → Pro" value={formatRate(rates.activatedToProRate)} tone="violet" />
            <CompactStatCard label="Pro nuevos" value={formatCount(metrics.newPro)} tone="emerald" />
            <CompactStatCard label="Pro activos" value={formatCount(metrics.activeProUsers)} tone="rose" />
            <CompactStatCard label="MRR" value={formatMrr(monetization.mrr)} tone="sky" />
          </div>

          {!monetization.mrrConfigured ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <p className="font-medium">MRR no calculado</p>
              <p className="mt-1 text-xs leading-5 text-sky-800">{monetization.mrrNote}</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--app-text-muted)]">{monetization.mrrNote}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="theme-surface-card">
          <CardContent className="space-y-5 p-6">
            <OperationalSectionHeader
              title="Conversión y suscripciones"
              description="Los usuarios nuevos se deduplican por cuenta; la suscripción confirmada es la fuente de conversión."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Activados" value={metrics.activated} icon={<CreditCard className="h-4 w-4 text-sky-600" />} />
              <Metric label="Pro nuevos" value={metrics.newPro} icon={<DollarSign className="h-4 w-4 text-emerald-600" />} />
              <Metric label="Suscripciones nuevas" value={metrics.newSubscriptions} icon={<CreditCard className="h-4 w-4 text-violet-600" />} />
              <Metric label="Suscripciones activas" value={metrics.activeSubscriptions} icon={<CreditCard className="h-4 w-4 text-rose-600" />} />
            </div>
          </CardContent>
        </Card>

        <Card className="theme-surface-card">
          <CardContent className="space-y-5 p-6">
            <OperationalSectionHeader
              title="Riesgo de churn"
              description="Indicadores operativos del periodo; la tasa es cancelación observada y no sustituye una cohorte histórica de churn."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Canceladas" value={metrics.canceledSubscriptions} icon={<UserMinus className="h-4 w-4 text-rose-600" />} />
              <Metric label="Cancelación observada" value={formatRate(rates.observedCancellationRate)} />
              <Metric label="Cancelación al cierre" value={metrics.pendingCancellation} />
              <Metric label="Past due" value={metrics.pastDueSubscriptions} />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-muted-surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-[var(--app-text-strong)]">{typeof value === "number" ? formatCount(value) : value}</p>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function formatRate(value: number) {
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatMrr(value: { cents: number; currency: "PEN" } | null) {
  if (!value) {
    return "No disponible";
  }

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value.cents / 100);
}
