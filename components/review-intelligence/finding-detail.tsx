"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FindingView } from "./types";
import { resolutionLabels, reviewLabel } from "./labels";

const resolutions = ["VALID_AS_IS", "CONFIRMED_ISSUE", "FALSE_POSITIVE", "NEEDS_MORE_INFORMATION", "CORRECTED", "NOT_APPLICABLE"] as const;
const reviewPermissionContext = createContext<boolean | undefined>(undefined);

export function ReviewPermissionProvider({ canResolve, children }: { canResolve: boolean; children: ReactNode }) { return <reviewPermissionContext.Provider value={canResolve}>{children}</reviewPermissionContext.Provider>; }

export function FindingDetail({ finding: selected, canResolve, onChanged, runStatus }: { finding?: FindingView; canResolve: boolean; onChanged: () => void; runStatus?: string }) {
  const contextualCanResolve = useContext(reviewPermissionContext);
  canResolve = contextualCanResolve ?? canResolve;
  const [page, setPage] = useState(selected?.evidence?.location.page ?? 1);
  const [sheet, setSheet] = useState(selected?.evidence?.location.sheet ?? "");
  const [note, setNote] = useState("");
  const [version, setVersion] = useState("");
  const [reconfirm, setReconfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selected) return <Card><CardContent className="p-6">Selecciona un hallazgo para ver comparación, evidencia y acciones.</CardContent></Card>;
  const finding = selected;
  const evidence = finding.evidence;
  const location = evidence?.location;
  const stale = finding.status === "STALE" || runStatus === "STALE";
  const isSheet = Boolean(location?.sheet);

  async function responseError(response: Response, fallback: string): Promise<string> { const payload = await response.json().catch(() => null) as { error?: unknown } | null; return typeof payload?.error === "string" ? payload.error : fallback; }
  async function decide(resolution: (typeof resolutions)[number]) {
    setError(null);
    const response = await fetch(`/api/review-findings/${finding.id}/decisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution, note: note || undefined, expectedUpdatedAt: finding.updatedAt, reconfirmStale: reconfirm, ...(resolution === "CORRECTED" ? { correctionVersionId: version } : {}) }) });
    if (!response.ok) { setError(await responseError(response, "No se pudo guardar la decisión.")); return; }
    onChanged();
  }
  async function validate(status: "CONFIRMED" | "REJECTED") {
    if (!finding.entityLink) return;
    setError(null);
    const response = await fetch(`/api/review-links/${finding.entityLink.id}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ validationStatus: status }) });
    if (!response.ok) { setError(await responseError(response, "No se pudo actualizar el vínculo.")); return; }
    onChanged();
  }

  return <Card data-testid="finding-detail">
    <CardHeader><CardTitle>{finding.budgetItem?.code ?? "Hallazgo"}</CardTitle>{error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}</CardHeader>
    <CardContent className="space-y-5">
      <section aria-label="Visor estructurado de provenance" className="space-y-2">
        <div><h4 className="text-sm font-semibold text-[var(--app-text-strong)]">Fuente primaria · Visor estructurado de evidencia</h4><p className="mt-1 text-xs text-[var(--app-text-muted)]">Consulta el fragmento utilizado para sustentar este hallazgo.</p></div>
        <div className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={isSheet ? !sheet : page <= 1} onClick={() => isSheet ? setSheet(`Hoja ${Math.max(1, Number(sheet.replace(/\D/g, "")) - 1)}`) : setPage((value) => Math.max(1, value - 1))}>Anterior</Button>{isSheet ? <input aria-label="Hoja de evidencia" value={sheet} onChange={(event) => setSheet(event.target.value)} className="h-8 w-32 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs" /> : <input aria-label="Página de evidencia" type="number" min={1} value={page} onChange={(event) => setPage(Math.max(1, Number(event.target.value)))} className="h-8 w-20 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs" />}<Button type="button" variant="outline" size="sm" onClick={() => isSheet ? setSheet(`Hoja ${Number(sheet.replace(/\D/g, "")) + 1}`) : setPage((value) => value + 1)}>Siguiente</Button></div>
          <p className="text-xs text-[var(--app-text-muted)]">{isSheet ? `Hoja seleccionada: ${sheet}` : `Página seleccionada: ${page}`} · Rango: {location?.range ?? "—"}</p>
          <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50 p-3 text-xs text-sky-950" data-testid="evidence-highlight">{location?.boundingBox ? `Bounding box resaltado: ${JSON.stringify(location.boundingBox)}` : isSheet && location?.row && location?.column ? `Celda resaltada: ${location.sheet}!${location.column}${location.row}` : "Fragmento estructurado seleccionado"}</div>
          <dl className="grid gap-2 sm:grid-cols-2"><Pair label="Texto original" value={evidence?.originalText ?? "—"} /><Pair label="Texto normalizado" value={evidence?.normalizedText ?? "—"} /><Pair label="Valor normalizado" value={evidence?.value ?? "—"} /><Pair label="Método" value={evidence?.extractionMethod ?? "—"} /></dl>
          {evidence?.viewUrl ? <a href={evidence.viewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Abrir fuente temporal</a> : null}
          <p className="text-[0.6875rem] text-[var(--app-text-muted)]">V0: navegación de provenance estructurada; no se presenta como render binario.</p>
        </div>
      </section>
      {finding.decisionHistory.length ? <section className="space-y-2"><h4 className="text-sm font-semibold text-[var(--app-text-strong)]">Historial de decisiones</h4><ul className="space-y-2 text-xs text-[var(--app-text-muted)]">{finding.decisionHistory.map((decision) => <li key={decision.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2"><span className="font-medium text-[var(--app-text-strong)]">{reviewLabel(resolutionLabels, decision.resolution)}</span>{decision.note ? `: ${decision.note}` : ""}</li>)}</ul></section> : null}
      <section aria-label="Revisión y decisión" className="space-y-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
        <div><h4 className="text-sm font-semibold text-[var(--app-text-strong)]">Decisión de revisión</h4><p className="mt-1 text-xs text-[var(--app-text-muted)]">Registra el criterio aplicado al hallazgo.</p></div>
        {stale ? <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><input type="checkbox" checked={reconfirm} onChange={(event) => setReconfirm(event.target.checked)} className="mt-0.5" />Confirmo el resultado obsoleto antes de decidir.</label> : null}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-[var(--app-text-muted)]"><span className="mb-1.5 block">Comentario o justificación</span><textarea aria-label="Comentario o justificación" value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20 w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20" placeholder="Explica brevemente tu decisión…" /></label><label className="text-xs font-medium text-[var(--app-text-muted)]"><span className="mb-1.5 block">ID de versión posterior <span className="font-normal">(solo si fue corregido)</span></span><input aria-label="ID de versión posterior" value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text)] outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20" placeholder="Ej. versión o identificador" /></label></div>
        {canResolve ? <div className="space-y-2" aria-label="Acciones humanas del hallazgo"><p className="text-xs font-medium text-[var(--app-text-muted)]">Selecciona una resolución</p><div className="flex flex-wrap gap-2">{resolutions.map((resolution) => <Button key={resolution} type="button" size="sm" variant={resolution === "CONFIRMED_ISSUE" ? "default" : "outline"} disabled={Boolean((stale && !reconfirm) || (resolution === "CORRECTED" && !version))} onClick={() => void decide(resolution)}>{reviewLabel(resolutionLabels, resolution)}</Button>)}</div></div> : null}
      </section>
      {finding.entityLink && canResolve ? <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3"><div><h4 className="text-sm font-semibold text-sky-950">Vínculo con la evidencia</h4><p className="mt-1 text-xs text-sky-800">Confirma si la fuente corresponde a esta partida.</p></div><div className="flex gap-2"><Button type="button" size="sm" onClick={() => void validate("CONFIRMED")}>Validar vínculo</Button><Button type="button" size="sm" variant="outline" onClick={() => void validate("REJECTED")}>Rechazar vínculo</Button></div></section> : null}
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><strong>Revisión humana requerida.</strong> El presupuesto no se modifica automáticamente.</p>
    </CardContent>
  </Card>;
}

function Pair({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs leading-5"><dt className="font-medium text-[var(--app-text-muted)]">{label}</dt><dd className="break-words text-[var(--app-text)]">{value}</dd></div>; }
