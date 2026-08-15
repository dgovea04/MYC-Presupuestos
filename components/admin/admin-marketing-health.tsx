import { Activity, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import type { AdminMarketingHealth } from "@/lib/data/admin-marketing-health";

type AdminMarketingHealthProps = {
  health: AdminMarketingHealth;
};

export function AdminMarketingHealth({ health }: AdminMarketingHealthProps) {
  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <OperationalSectionHeader
            title="Salud de la instrumentación"
            description="Controles rápidos para detectar eventos faltantes, atribución incompleta y posibles duplicados."
          />
          <span className="inline-flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
            <Activity className="h-4 w-4" aria-hidden="true" />
            {health.available ? "Eventos internos activos" : "Eventos internos no disponibles"}
          </span>
        </div>

        {!health.available ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            No se pudo consultar la tabla de eventos internos.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CompactStatCard label="Eventos" value={formatCount(health.totalEvents)} tone="sky" />
          <CompactStatCard label="Sin usuario" value={formatCount(health.anonymousEvents)} tone="slate" />
          <CompactStatCard label="Signup sin UTM" value={formatCount(health.unattributedSignups)} tone="amber" />
          <CompactStatCard label="Posibles duplicados" value={formatCount(health.possibleDuplicates)} tone="rose" />
          <CompactStatCard label="Último evento" value={formatLastEvent(health.lastEventAt)} tone="emerald" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-muted-surface)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              {health.missingCoreEvents.length === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}
              Eventos principales
            </div>
            {health.missingCoreEvents.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700">Todos los eventos principales aparecen en el rango.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-amber-700">Sin ocurrencias en el rango seleccionado:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {health.missingCoreEvents.map((eventName) => (
                    <span key={eventName} className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">{eventName}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-muted-surface)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <Clock3 className="h-4 w-4 text-sky-600" aria-hidden="true" />
              Eventos recibidos
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {health.eventCounts.length === 0 ? (
                <p className="text-sm text-[var(--app-text-muted)]">No hay eventos en el rango seleccionado.</p>
              ) : (
                health.eventCounts.map((event) => (
                  <span key={event.name} className="rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs text-[var(--app-text-muted)]">
                    <span className="font-medium text-[var(--app-text-strong)]">{event.name}</span>: {formatCount(event.count)}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function formatLastEvent(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}
