import { cn } from "@/lib/utils";
import type { ResourceRecord } from "@/types/resource";

export function ResourcePriceStatus({ resource, compact = false }: { resource: Pick<ResourceRecord, "priceSyncStatus" | "priceObservedAt" | "priceSource">; compact?: boolean }) {
  const status = resource.priceSyncStatus ?? "UNKNOWN";
  const label = status === "FRESH" ? "Actualizado" : status === "STALE" ? "Desactualizado" : status === "ERROR" ? "Error" : "Sin sincronizar";
  const tone = status === "FRESH" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "STALE" ? "border-amber-200 bg-amber-50 text-amber-700" : status === "ERROR" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600";
  const observed = resource.priceObservedAt ? new Date(resource.priceObservedAt).toLocaleDateString("es-PE") : null;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", tone)} title={observed ? `${label} · ${observed} · ${resource.priceSource ?? "Fuente no indicada"}` : label}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {compact ? label : `${label}${observed ? ` · ${observed}` : ""}`}
    </span>
  );
}
