import { AlertTriangle, Globe2, ShieldAlert, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import type { AdminSecuritySignal } from "@/lib/data/admin-security";

type AdminSecurityOverviewData = {
  windowHours: number;
  metrics: {
    totalEvents: number;
    criticalEvents: number;
    uniqueActors: number;
    uniqueIps: number;
  };
  signals: AdminSecuritySignal[];
  recentEvents: Array<{
    id: string;
    action: string;
    targetEmail: string;
    actorEmail: string | null;
    ipAddress: string | null;
    detail: string | null;
    createdAt: string;
  }>;
};

export function AdminSecurityOverview({ overview }: { overview: AdminSecurityOverviewData }) {
  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-6">
        <OperationalSectionHeader
          title="Centro de seguridad"
          description={`Actividad administrativa de las últimas ${overview.windowHours} horas.`}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactStatCard label="Eventos" value={String(overview.metrics.totalEvents)} tone="sky" />
          <CompactStatCard label="Eventos sensibles" value={String(overview.metrics.criticalEvents)} tone="amber" />
          <CompactStatCard label="Administradores activos" value={String(overview.metrics.uniqueActors)} tone="emerald" />
          <CompactStatCard label="IPs administrativas" value={String(overview.metrics.uniqueIps)} tone="violet" />
        </div>

        {overview.signals.length > 0 ? (
          <div className="theme-status-warning rounded-2xl border px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <p className="font-medium">Revisión recomendada</p>
            </div>
            <div className="mt-2 grid gap-2">
              {overview.signals.map((signal, index) => (
                <p key={`${signal.actorEmail}-${signal.kind}-${index}`} className="text-sm">
                  <strong>{signal.actorEmail}</strong>: {signal.detail}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="theme-status-success flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
            <ShieldAlert className="h-4 w-4" />
            No se detectaron patrones administrativos inusuales en esta ventana.
          </div>
        )}

        {overview.recentEvents.length > 0 ? (
          <div className="grid gap-2">
            <p className="theme-muted-text text-xs font-semibold uppercase tracking-[0.14em]">Actividad reciente</p>
            {overview.recentEvents.map((event) => (
              <div key={event.id} className="theme-muted-panel flex items-start gap-3 rounded-xl border px-3 py-2 text-sm">
                <span className="theme-filter-button-active inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  {event.ipAddress ? <Globe2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="theme-strong-text truncate font-medium">{formatAction(event.action)}</p>
                  <p className="theme-muted-text truncate text-xs">
                    {event.actorEmail ?? "Sistema"} · {event.targetEmail} · {formatDate(event.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
