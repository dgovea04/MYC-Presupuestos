"use client";
import { useState } from "react";
import { IntegrationPreviewTable } from "./integration-preview-table";

type Session = { id: string; status: string; confirmationToken?: string | null; requestId: string; expectedVersion?: number | null; counts?: { total?: number; valid?: number; conflicts?: number } | null; preview?: { rows?: Array<{ externalKey: string; action: string; description?: string; conflict?: string }> } | null };

export function IntegrationSessionLauncher({ budgetId, adapter, payload, canApply = true }: { budgetId: string; adapter: string; payload: string; canApply?: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function prepare() {
    setBusy(true); setError(null);
    try {
      const created = await fetch(`/api/budgets/${encodeURIComponent(budgetId)}/integrations/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adapter, contractVersion: "1", payload, requestId: `${adapter}:${budgetId}:${payload.length}` }) });
      const createdBody = await created.json() as { session?: Session; error?: string };
      if (!created.ok || !createdBody.session) throw new Error(createdBody.error ?? "No se pudo crear la sesión");
      const staged = await fetch(`/api/budgets/${encodeURIComponent(budgetId)}/integrations/sessions/${createdBody.session.id}/validate`, { method: "POST" });
      if (!staged.ok) throw new Error("No se pudo validar la sesión");
      const preview = await fetch(`/api/budgets/${encodeURIComponent(budgetId)}/integrations/sessions/${createdBody.session.id}/preview`);
      const previewBody = await preview.json() as Session & { error?: string };
      if (!preview.ok) throw new Error(previewBody.error ?? "No se pudo cargar la preview");
      setSession({ ...createdBody.session, ...previewBody });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar la sesión"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3"><button type="button" onClick={() => void prepare()} disabled={busy} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 disabled:opacity-50">{busy ? "Preparando sesión…" : "Preparar sesión controlada"}</button>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}{session ? <IntegrationSessionPanel budgetId={budgetId} session={session} canApply={canApply} onApplied={() => setSession((current) => current ? { ...current, status: "APPLIED" } : current)} onRefresh={() => setSession(null)} /> : null}</div>;
}

export function IntegrationSessionPanel({ budgetId, session, canApply, onApplied, onRefresh }: { budgetId: string; session: Session; canApply: boolean; onApplied?: () => void; onRefresh?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  async function confirm() { if (!session.confirmationToken || session.expectedVersion === null || session.expectedVersion === undefined) { setMessage("La sesión no expone una versión confirmable."); return; } setBusy(true); try { const response = await fetch(`/api/budgets/${budgetId}/integrations/sessions/${session.id}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmationToken: session.confirmationToken, expectedVersion: session.expectedVersion, requestId: `${session.id}:apply` }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "No se pudo aplicar la sesión"); setMessage("Sesión aplicada y auditada"); onApplied?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); } finally { setBusy(false); } }
  async function rollback() { setBusy(true); try { const response = await fetch(`/api/budgets/${budgetId}/integrations/sessions/${session.id}/rollback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: `${session.id}:rollback` }) }); if (!response.ok) throw new Error("No se pudo revertir la sesión"); setMessage("Sesión revertida"); onRefresh?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); } finally { setBusy(false); } }
  return <section aria-label="Sesión de integración" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wide text-slate-500">Sesión controlada</p><h2 className="text-base font-semibold text-slate-900">{session.status}</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{session.counts?.total ?? 0} registros</span></div>{session.counts?.conflicts ? <p className="text-sm text-red-600">Hay {session.counts.conflicts} conflictos que deben resolverse.</p> : null}{session.preview?.rows ? <IntegrationPreviewTable rows={session.preview.rows} /> : null}<p className="text-xs text-slate-500">La preview y las sugerencias no modifican automáticamente el presupuesto.</p>{canApply && session.status === "PREVIEW_READY" ? <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><label className="flex items-start gap-2 text-sm text-amber-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo explícitamente esta aplicación.</label><button type="button" onClick={() => void confirm()} disabled={!confirmed || busy || Boolean(session.counts?.conflicts)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Aplicando…" : "Confirmar y aplicar"}</button></div> : null}{canApply && session.status === "APPLIED" ? <button type="button" onClick={() => void rollback()} disabled={busy} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">{busy ? "Revirtiendo…" : "Rollback"}</button> : null}{message && <p role="status" className="text-sm text-slate-600">{message}</p>}</section>;
}
