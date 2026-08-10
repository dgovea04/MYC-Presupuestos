import { SkeletonBlock, SkeletonCard, SkeletonChart, SkeletonText } from "@/components/ui/loading";

export function KhipuQualityMetricsSkeleton() {
  return (
    <SkeletonCard busyLabel="Cargando metricas de calidad Khipu" className="min-h-[520px]">
      <div className="space-y-4">
        <SkeletonText lines={1} widths={["w-40"]} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-20" radius="2xl" />
          ))}
        </div>
        <SkeletonBlock className="h-4 w-full" radius="full" />
        <SkeletonChart aria-label="Cargando tendencia de calidad Khipu" />
      </div>
    </SkeletonCard>
  );
}
