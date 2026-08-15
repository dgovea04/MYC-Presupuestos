import { BarChart3, Download, Filter, Users, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { getOnboardingRecommendation } from "@/lib/dashboard/onboarding-recommendation";
import {
  formatAdminMarketingDateInput,
  type AdminMarketingAnalytics,
  type AdminMarketingDateRange,
} from "@/lib/data/admin-marketing-analytics";

type AdminMarketingAnalyticsProps = {
  analytics: AdminMarketingAnalytics;
  range: AdminMarketingDateRange;
};

export function AdminMarketingAnalytics({ analytics, range }: AdminMarketingAnalyticsProps) {
  const { metrics, rates } = analytics;
  const onboardingRecommendation = getOnboardingRecommendation(analytics.ahaMoments[0]);

  return (
    <section className="space-y-6" aria-label="Marketing Analytics">
      <Card className="theme-surface-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <OperationalSectionHeader
              title="Marketing Analytics"
              description="Funnel interno de adquisición, activación y conversión a Pro. Los eventos se almacenan sin datos personales ni contenido de presupuestos."
              className="max-w-3xl"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--app-text-muted)]">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Fuente: eventos internos + suscripciones activas
              </span>
              <a
                href={`/api/admin/marketing-analytics/export?from=${formatAdminMarketingDateInput(range.from)}&to=${formatAdminMarketingDateInput(new Date(range.to.getTime() - 24 * 60 * 60 * 1000))}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Descargar CSV
              </a>
            </div>
          </div>

          <form action="/admin" method="get" className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-muted-surface)] p-4 sm:flex-row sm:items-end">
            <label className="grid gap-1 text-xs font-medium text-[var(--app-text-muted)]">
              Desde
              <input
                type="date"
                name="marketingFrom"
                defaultValue={formatAdminMarketingDateInput(range.from)}
                className="theme-surface-card theme-strong-text min-h-10 rounded-xl border px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--app-text-muted)]">
              Hasta
              <input
                type="date"
                name="marketingTo"
                defaultValue={formatAdminMarketingDateInput(new Date(range.to.getTime() - 24 * 60 * 60 * 1000))}
                className="theme-surface-card theme-strong-text min-h-10 rounded-xl border px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <button type="submit" className="theme-filter-button-active inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition hover:brightness-95">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Aplicar rango
            </button>
            <p className="text-xs text-[var(--app-text-subtle)] sm:ml-auto sm:pb-2">Máximo 90 días</p>
          </form>

          {!analytics.available ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              El almacenamiento interno de analytics aún no está disponible. Aplica la migración de marketing events para comenzar a registrar métricas.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CompactStatCard label="Visitantes" value={formatCount(metrics.visitors)} tone="sky" />
            <CompactStatCard label="Signup" value={formatCount(metrics.signups)} tone="violet" />
            <CompactStatCard label="Activated" value={formatCount(metrics.activated)} tone="emerald" />
            <CompactStatCard label="WAU / WAB" value={`${formatCount(metrics.wau)} / ${formatCount(metrics.wab)}`} tone="amber" />
            <CompactStatCard label="Pro activos" value={formatCount(metrics.pro)} tone="rose" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="theme-surface-card">
          <CardContent className="space-y-5 p-6">
            <OperationalSectionHeader
              title="Embudo de conversión"
              description="Las tasas se calculan sobre usuarios únicos del rango seleccionado."
            />
            <div className="grid gap-3 sm:grid-cols-4">
              <FunnelStep label="Visitantes" value={metrics.visitors} />
              <FunnelStep label="Signup" value={metrics.signups} rate={rates.signupRate} />
              <FunnelStep label="Activated" value={metrics.activated} rate={rates.activationRate} />
              <FunnelStep label="Pro nuevos" value={metrics.newPro} rate={rates.proRate} />
            </div>
            <div className="grid gap-3 border-t border-[var(--app-border-soft)] pt-4 sm:grid-cols-3">
              <MiniMetric label="Upgrade clicked" value={metrics.upgradeClicked} />
              <MiniMetric label="Checkout started" value={metrics.checkoutStarted} />
              <MiniMetric label="Suscripciones creadas" value={metrics.subscriptionCreated} />
            </div>
          </CardContent>
        </Card>

        <Card className="theme-surface-card">
          <CardContent className="space-y-5 p-6">
            <OperationalSectionHeader
              title="Canales de adquisición"
              description="Atribución first-touch por fuente, medio, campaña y contenido de los registros disponibles."
            />
            {analytics.byUtm.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">
                Todavía no hay registros atribuidos en este rango.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-soft)]">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[var(--app-muted-surface)] text-left text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Fuente</th>
                      <th className="px-4 py-3 font-medium">Medio</th>
                      <th className="px-4 py-3 font-medium">Campaña</th>
                      <th className="px-4 py-3 font-medium">Contenido</th>
                      <th className="px-4 py-3 text-right font-medium">Signup</th>
                      <th className="px-4 py-3 text-right font-medium">Activados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byUtm.map((entry) => (
                      <tr key={`${entry.source}-${entry.medium}-${entry.campaign}-${entry.content}`} className="border-t border-[var(--app-border-soft)]">
                        <td className="max-w-[9rem] truncate px-4 py-3 font-medium text-[var(--app-text-strong)]" title={entry.source}>{entry.source}</td>
                        <td className="max-w-[9rem] truncate px-4 py-3 text-[var(--app-text-muted)]" title={entry.medium}>{entry.medium}</td>
                        <td className="max-w-[11rem] truncate px-4 py-3 text-[var(--app-text-muted)]" title={entry.campaign}>{entry.campaign}</td>
                        <td className="max-w-[11rem] truncate px-4 py-3 text-[var(--app-text-muted)]" title={entry.content}>{entry.content}</td>
                        <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatCount(entry.signups)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatCount(entry.activated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="theme-surface-card">
        <CardContent className="space-y-5 p-6">
          <OperationalSectionHeader
            title="Aha moment"
            description="Primera acción técnica realizada dentro de los 7 días posteriores al registro, ordenada por usuarios activados."
          />
          {onboardingRecommendation ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Recomendación para onboarding</p>
                <p className="mt-1 text-xs leading-5 text-sky-800">{onboardingRecommendation.title}: {onboardingRecommendation.description}</p>
              </div>
              <a href={onboardingRecommendation.href} className="shrink-0 font-medium text-sky-700 underline-offset-4 hover:underline">Ver flujo</a>
            </div>
          ) : null}
          {analytics.ahaMoments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">
              Todavía no hay suficientes acciones posteriores al registro para identificar un aha moment.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-soft)]">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[var(--app-muted-surface)] text-left text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Primera acción</th>
                    <th className="px-4 py-3 text-right font-medium">Usuarios</th>
                    <th className="px-4 py-3 text-right font-medium">Signup → Activación</th>
                    <th className="px-4 py-3 text-right font-medium">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.ahaMoments.map((entry) => (
                    <tr key={entry.eventName} className="border-t border-[var(--app-border-soft)]">
                      <td className="px-4 py-3 font-medium text-[var(--app-text-strong)]">{entry.eventName}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCount(entry.users)}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatRate(entry.activationRate)}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatRate(entry.shareOfActivated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="theme-surface-card">
        <CardContent className="space-y-5 p-6">
          <OperationalSectionHeader
            title="Cohortes y retención"
            description="Cohortes semanales según la fecha de registro. W1, W4 y W8 muestran usuarios que volvieron a realizar una acción técnica significativa."
          />
          {analytics.cohorts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">
              Todavía no hay cohortes de registro en este rango.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-soft)]">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[var(--app-muted-surface)] text-left text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Semana</th>
                    <th className="px-4 py-3 text-right font-medium">Signup</th>
                    <th className="px-4 py-3 text-right font-medium">Activated</th>
                    <th className="px-4 py-3 text-right font-medium">Activación</th>
                    <th className="px-4 py-3 text-right font-medium">W1</th>
                    <th className="px-4 py-3 text-right font-medium">W4</th>
                    <th className="px-4 py-3 text-right font-medium">W8</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.cohorts.map((cohort) => (
                    <tr key={cohort.week} className="border-t border-[var(--app-border-soft)]">
                      <td className="px-4 py-3 font-medium text-[var(--app-text-strong)]">{cohort.week}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatCount(cohort.signups)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCount(cohort.activated)}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatRate(cohort.activationRate)}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatRetention(cohort.w1)}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatRetention(cohort.w4)}</td>
                      <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatRetention(cohort.w8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function FunnelStep({ label, value, rate }: { label: string; value: number; rate?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-muted-surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
        <Users className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text-strong)]">{formatCount(value)}</p>
      {rate !== undefined ? <p className="mt-1 text-xs text-[var(--app-text-muted)]">{formatRate(rate)} desde el paso anterior</p> : <p className="mt-1 text-xs text-[var(--app-text-muted)]">Base del funnel</p>}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-border-soft)] px-3 py-2 text-sm">
      <span className="text-[var(--app-text-muted)]">{label}</span>
      <span className="inline-flex items-center gap-1 font-semibold text-[var(--app-text-strong)]">
        <Zap className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
        {formatCount(value)}
      </span>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function formatRate(value: number) {
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatRetention(value: { users: number | null; rate: number | null }) {
  if (value.users === null || value.rate === null) {
    return "—";
  }

  return `${formatCount(value.users)} · ${formatRate(value.rate)}`;
}
