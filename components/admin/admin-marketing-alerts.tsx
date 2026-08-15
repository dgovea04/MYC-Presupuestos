import { AlertCircle, AlertTriangle, BellRing } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import type { MarketingAlert } from "@/lib/data/admin-marketing-alerts";

type AdminMarketingAlertsProps = {
  alerts: MarketingAlert[];
};

export function AdminMarketingAlerts({ alerts }: AdminMarketingAlertsProps) {
  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-5 p-6">
        <OperationalSectionHeader
          title="Alertas de analytics"
          description="Prioridades detectadas automáticamente para revisar la calidad del funnel y la reconciliación."
        />
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            <BellRing className="h-4 w-4" aria-hidden="true" />
            No hay alertas accionables en el rango seleccionado.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((alert) => (
              <div key={alert.key} className={`rounded-2xl border px-4 py-3 ${getAlertClassName(alert.severity)}`}>
                <div className="flex items-start gap-3">
                  {alert.severity === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="mt-1 text-xs leading-5 opacity-90">{alert.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getAlertClassName(severity: MarketingAlert["severity"]) {
  if (severity === "error") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-sky-200 bg-sky-50 text-sky-800";
}
