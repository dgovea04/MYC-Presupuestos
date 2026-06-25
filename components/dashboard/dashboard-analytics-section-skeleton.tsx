import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";

export function DashboardAnalyticsSectionSkeleton() {
  return (
    <section className="space-y-4">
      <OperationalSectionHeader
        title="Analitica y KPIs"
        description="Cargando metricas avanzadas de presupuestos, tendencias y alertas..."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <AnalyticsChartSkeleton title="Costo por fase / subpresupuesto" height="h-64" />
        <AnalyticsChartSkeleton title="Comparativa de presupuestos" height="h-64" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <AnalyticsChartSkeleton title="Tendencias de K historicas" height="h-64" />
        <AnalyticsChartSkeleton title="Alertas de desviacion" height="h-64" />
      </div>
    </section>
  );
}

function AnalyticsChartSkeleton({ title, height }: { title: string; height: string }) {
  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">
          <span className="inline-block h-5 w-48 animate-pulse rounded-md bg-slate-200" />
        </CardTitle>
      </CardHeader>
      <CardContent className={`px-5 pb-5 ${height}`}>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
        </div>
      </CardContent>
    </Card>
  );
}
