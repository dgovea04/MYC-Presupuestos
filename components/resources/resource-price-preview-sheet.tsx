"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { ResourcePricePreviewItem } from "@/types/resource-pricing";

export function ResourcePricePreviewSheet({
  items,
  canApply,
  applying,
  onApply,
  onClose,
}: {
  items: ResourcePricePreviewItem[];
  canApply: boolean;
  applying: boolean;
  onApply: (itemIds: string[]) => void;
  onClose: () => void;
}) {
  const changedItems = useMemo(() => items.filter((item) => item.status === "UPDATED"), [items]);
  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Preview de actualización de precios">
      <div className="mx-auto mt-8 max-h-[calc(100vh-4rem)] w-[min(1100px,100%)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preview de precios</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Revisa antes de actualizar el catálogo</h2>
            <p className="mt-1 text-sm text-slate-500">{changedItems.length} cambios propuestos · {items.length - changedItems.length} sin cambio o con revisión</p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
        <div className="max-h-[55vh] overflow-auto p-6">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Insumo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Propuesto</th>
                <th className="px-3 py-2">Unidad/moneda</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-800">{item.description ?? item.resourceId ?? "Sin match"}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.status}</span></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{item.oldPrice ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{item.newPrice ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-600">{item.newUnit ?? item.oldUnit ?? "—"} · {item.newCurrency ?? item.oldCurrency ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{item.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <p className="text-xs text-slate-500">Los precios de presupuestos y APUs existentes no se modifican.</p>
          {canApply ? <Button type="button" disabled={applying || changedItems.length === 0} onClick={() => onApply(changedItems.map((item) => item.id))}>{applying ? "Aplicando..." : `Aplicar ${changedItems.length} cambios`}</Button> : <span className="text-xs font-medium text-slate-500">Solo un administrador de MC Presupuestos puede aplicar cambios.</span>}
        </div>
      </div>
    </div>
  );
}
