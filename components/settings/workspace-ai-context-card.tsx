"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Usage = { aiUsage?: { consumedTokens: number; limit: number | null; actualCostMinor: number; requests: number }; plan?: { name: string } | null };
type Props = { workspaceId: string };

export function WorkspaceAiContextCard({ workspaceId }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; void fetch(`/api/workspaces/${workspaceId}/usage`, { cache: "no-store" }).then(async (response) => { const payload: unknown = await response.json(); if (!response.ok) throw new Error("No se pudo cargar el uso de IA."); if (!cancelled) setUsage(payload as Usage); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el uso de IA."); }); return () => { cancelled = true; }; }, [workspaceId]);
  if (error) return <Card><CardContent className="p-5 text-sm text-rose-700">{error}</CardContent></Card>;
  if (!usage) return <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando uso de IA...</CardContent></Card>;
  const ai = usage.aiUsage; const percentage = ai?.limit ? Math.min(100, Math.round((ai.consumedTokens / ai.limit) * 100)) : null;
  return <Card className="border-[var(--app-border)] bg-[var(--app-surface)]"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Uso y contexto IA</CardTitle><CardDescription>Consulta el consumo del Workspace sin exponer prompts ni secretos.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Solicitudes" value={String(ai?.requests ?? 0)} /><Metric label="Tokens" value={`${ai?.consumedTokens ?? 0}${ai?.limit === null || ai?.limit === undefined ? "" : ` / ${ai.limit}`}`} /><Metric label="Costo estimado" value={`${((ai?.actualCostMinor ?? 0) / 100).toFixed(2)} unidades`} /></div>{percentage !== null ? <div className="space-y-2"><div className="flex justify-between text-xs"><span>Cuota mensual</span><strong>{percentage}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${percentage >= 90 ? "bg-rose-500" : percentage >= 80 ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${percentage}%` }} /></div></div> : <p className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]"><ShieldCheck className="h-4 w-4" />Sin límite mensual configurado.</p>}{usage.plan ? <p className="text-xs text-[var(--app-text-muted)]">Plan activo: {usage.plan.name}</p> : null}</CardContent></Card>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--app-border)] p-3"><p className="text-xs text-[var(--app-text-muted)]">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>; }
