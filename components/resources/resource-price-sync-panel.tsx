"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourcePricePreviewSheet } from "@/components/resources/resource-price-preview-sheet";
import { useResourcePriceUpdateStream } from "@/hooks/use-resource-price-update-stream";
import type { ResourceRecord } from "@/types/resource";
import type { ResourcePricePreviewItem, ResourcePriceRequestSummary } from "@/types/resource-pricing";

export function ResourcePriceSyncPanel({ resources, canApply }: { resources: ResourceRecord[]; canApply: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState<ResourcePricePreviewItem[]>([]);
  const [request, setRequest] = useState<ResourcePriceRequestSummary | null>(null);
  const stream = useResourcePriceUpdateStream(request?.id ?? null, { enabled: Boolean(request && preview.length > 0) });
  const globalResourceIds = useMemo(() => resources.filter((resource) => !resource.companyId).map((resource) => resource.id), [resources]);
  const staleCount = useMemo(() => resources.filter((resource) => !resource.companyId && resource.priceSyncStatus !== "FRESH").length, [resources]);

  async function requestPrices() {
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/resources/price-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceIds: globalResourceIds, mode: "ON_DEMAND", idempotencyKey: `ui:${Date.now()}:${globalResourceIds.length}` }),
      });
      const data = (await response.json()) as { error?: string; request?: ResourcePriceRequestSummary; items?: ResourcePricePreviewItem[] };
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar el proveedor principal.");
      setRequest(data.request ?? null);
      setPreview(data.items ?? []);
      setFeedback("Consulta completada. Revisa el preview antes de aplicar cambios.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo consultar el proveedor principal.");
    } finally {
      setLoading(false);
    }
  }

  async function applyPrices(itemIds: string[]) {
    if (!request) return;
    setApplying(true);
    setError("");
    try {
      const response = await fetch(`/api/resources/price-updates/${request.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      });
      const data = (await response.json()) as { error?: string; appliedCount?: number };
      if (!response.ok) throw new Error(data.error ?? "No se pudo aplicar el preview.");
      setFeedback(`${data.appliedCount ?? 0} precios actualizados en el catálogo global.`);
      setPreview([]);
      router.refresh();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "No se pudo aplicar el preview.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700"><RefreshCw className="h-4 w-4" aria-hidden="true" /></div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Precios del catálogo global</h2>
              <p className="mt-1 text-xs text-slate-500">Consulta el proveedor principal administrado por MC Presupuestos. Los presupuestos existentes no se modifican.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{globalResourceIds.length} insumos globales</span>
                <span>·</span>
                <span>{staleCount} pendientes de consulta</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Fuente controlada por MC</span>
                {request && preview.length > 0 ? <span>· Progreso {stream.mode === "sse" ? "en tiempo real" : stream.mode === "polling" ? "por polling" : "conectando"}</span> : null}
              </div>
            </div>
          </div>
          <Button type="button" onClick={() => void requestPrices()} disabled={loading || globalResourceIds.length === 0} className="gap-2">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {loading ? "Consultando..." : "Consultar precios"}
          </Button>
        </div>
        {feedback ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{feedback}</p> : null}
        {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
      </section>
      <ResourcePricePreviewSheet items={preview} canApply={canApply} applying={applying} onApply={(itemIds) => void applyPrices(itemIds)} onClose={() => setPreview([])} />
    </>
  );
}
