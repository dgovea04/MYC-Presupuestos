import { SkeletonChart } from "@/components/ui/loading";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";

export function DashboardAnalyticsSectionSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando analitica y KPIs" className="space-y-4" role="status">
      <OperationalSectionHeader
        title="Analitica y KPIs"
        description="Cargando metricas avanzadas de presupuestos, tendencias y alertas..."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonChart aria-label="Cargando distribucion de presupuestos" className="min-h-[340px]" />
        <SkeletonChart aria-label="Cargando tendencia de proyectos" className="min-h-[320px]" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonChart aria-label="Cargando alertas de costos" className="min-h-[360px]" />
        <SkeletonChart aria-label="Cargando rendimiento de catalogos" className="min-h-[320px]" />
      </div>
    </section>
  );
}
