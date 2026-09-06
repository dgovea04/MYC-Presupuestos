"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { ReviewRunView } from "./types";

type ComparisonSummary = { new: number; persistent: number; resolved: number; changed: number };

export function RunComparisonPanel({ budgetId, selectedRun, runs }: { budgetId: string; selectedRun: ReviewRunView; runs: ReviewRunView[] }) {
  const [baseRunId, setBaseRunId] = useState("");
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function compare() {
    if (!baseRunId) return;
    setLoading(true); setError(null);
    try { const response = await fetch(`/api/budgets/${encodeURIComponent(budgetId)}/review-runs/compare?baseRunId=${encodeURIComponent(baseRunId)}&compareRunId=${encodeURIComponent(selectedRun.id)}`); const payload = await response.json() as { summary?: ComparisonSummary; error?: string }; if (!response.ok || !payload.summary) throw new Error(payload.error ?? "No se pudo comparar"); setSummary(payload.summary); }
    catch (comparisonError) { setError(comparisonError instanceof Error ? comparisonError.message : "No se pudo comparar"); }
    finally { setLoading(false); }
  }
  return <Card className="theme-surface-card" data-testid="run-comparison-panel"><CardContent className="flex flex-col gap-3 p-4"><div><h3 className="text-sm font-semibold text-[var(--app-text-strong)]">Comparar ejecuciones</h3><p className="mt-1 text-xs text-[var(--app-text-muted)]">Identifica hallazgos nuevos, persistentes, resueltos y cambiados.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-medium text-[var(--app-text-muted)]"><span className="mb-1.5 block">Ejecución base</span><Select aria-label="Ejecución base para comparar" value={baseRunId} onChange={(event) => setBaseRunId(event.target.value)}><option value="">Selecciona una ejecución</option>{runs.filter((run) => run.id !== selectedRun.id).map((run) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} · {run.status}</option>)}</Select></label><Button type="button" variant="outline" size="sm" onClick={() => void compare()} disabled={!baseRunId} loading={loading}>Comparar</Button></div>{error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}{summary ? <p className="text-xs text-[var(--app-text-muted)]">Nuevos: {summary.new} · Persistentes: {summary.persistent} · Resueltos: {summary.resolved} · Cambiados: {summary.changed}</p> : null}</CardContent></Card>;
}
