import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import type { AdminMarketingReconciliation } from "@/lib/data/admin-marketing-reconciliation";

type AdminMarketingReconciliationProps = {
  reconciliation: AdminMarketingReconciliation;
};

export function AdminMarketingReconciliation({ reconciliation }: AdminMarketingReconciliationProps) {
  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <OperationalSectionHeader
            title="Reconciliación de fuentes"
            description="Compara los eventos internos con las fuentes oficiales de usuarios, producto y billing del mismo rango seleccionado."
          />
          <span className="inline-flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {formatCheckedAt(reconciliation.checkedAt)}
          </span>
        </div>

        {!reconciliation.available ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            No se pudo consultar la reconciliación. Verifica la conexión de base de datos y la migración de analytics.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-soft)]">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-[var(--app-muted-surface)] text-left text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Métrica</th>
                  <th className="px-4 py-3 font-medium">Fuente oficial</th>
                  <th className="px-4 py-3 text-right font-medium">Evento interno</th>
                  <th className="px-4 py-3 text-right font-medium">Fuente</th>
                  <th className="px-4 py-3 text-right font-medium">Diferencia</th>
                  <th className="px-4 py-3 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.rows.map((row) => (
                  <tr key={row.key} className="border-t border-[var(--app-border-soft)]">
                    <td className="px-4 py-3 font-medium text-[var(--app-text-strong)]">{row.label}</td>
                    <td className="px-4 py-3 text-xs text-[var(--app-text-muted)]">{row.source}</td>
                    <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatCount(row.internalCount)}</td>
                    <td className="px-4 py-3 text-right text-[var(--app-text-muted)]">{formatCount(row.sourceCount)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${row.difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                      {formatSignedCount(row.difference)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${row.status === "match" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {row.status === "match" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                        {row.status === "match" ? "Coincide" : "Revisar"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-muted-surface)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">GA4 Data API</p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">Datos de la propiedad GA4 para contrastar visitantes y eventos reportados.</p>
            </div>
            {reconciliation.ga4.available ? (
              <span className="text-sm font-semibold text-sky-700">{formatCount(reconciliation.ga4.activeUsers)} usuarios activos</span>
            ) : null}
          </div>
          {reconciliation.ga4.available ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {reconciliation.ga4.events.map((event) => (
                <span key={event.name} className="rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
                  <span className="font-medium text-[var(--app-text-strong)]">{event.name}</span>: {formatCount(event.count)} · {formatCount(event.users)} usuarios
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-amber-700">{reconciliation.ga4.reason}</p>
          )}
        </div>

        <p className="text-xs leading-5 text-[var(--app-text-subtle)]">
          GA4 se consulta únicamente desde el servidor. La cuenta de servicio debe tener permiso de lectura sobre la propiedad y sus credenciales nunca se envían al navegador.
        </p>
      </CardContent>
    </Card>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function formatSignedCount(value: number) {
  return value > 0 ? `+${formatCount(value)}` : formatCount(value);
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Consulta reciente" : `Consultado ${date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
}
