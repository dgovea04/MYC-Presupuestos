"use client";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
type Props = { layers: Array<{ scope: string; label: string }>; restrictions: string[] };
export function WorkspaceAiEffectivePolicyCard({ layers, restrictions }: Props) {
  return <Card aria-label="Política efectiva de IA"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" />Política efectiva</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-[var(--app-text-muted)]">Las restricciones heredadas solo pueden reducir permisos, modelos o límites.</p><div className="flex flex-wrap gap-2" aria-label="Capas aplicadas">{layers.map((layer) => <span key={`${layer.scope}-${layer.label}`} className="rounded-full border px-2.5 py-1 text-xs">{layer.label} · {layer.scope}</span>)}</div>{restrictions.length > 0 ? <ul className="space-y-1 text-xs text-amber-700" aria-label="Restricciones heredadas">{restrictions.map((restriction) => <li key={restriction}>• {restriction}</li>)}</ul> : <p className="text-xs text-[var(--app-text-muted)]">No hay restricciones adicionales.</p>}</CardContent></Card>;
}
