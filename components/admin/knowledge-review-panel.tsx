"use client";

import { useState } from "react";

type Candidate = { id: string; name: string; scope: string; aliases: Array<{ alias: string; confirmed: boolean }> };
type Assertion = { id: string; subjectType: string; subjectId: string; predicate: string; value?: unknown; scope: string; status: string; confidence: string; companyId: string | null; projectId: string | null; evidenceId: string | null; reviewDecisionId?: string | null; updatedAt: string };
type Observation = { id: string; value: string; unit: string; scope: string; confidence: string; evidenceId: string | null; observedAt: string; resourceId?: string; canonicalItemId?: string };
type Evidence = { id: string; sourceId: string; documentId: string | null; fileName: string | null; page: string | null; sheet: string | null; cellRange: string | null; quote: string | null; createdAt: string };
type Conflict = { id: string; assertionId: string; conflictingAssertionId: string; status: string; reason: string; companyId: string | null; projectId: string | null; createdAt: string };
type IntegrationError = { id: string; status: string; attemptCount: number; errorCode: string | null; errorMessage: string | null; findingId: string | null; decisionId: string | null; jobType?: string };

type Props = {
  items: Candidate[];
  resources: Candidate[];
  assertions?: Assertion[];
  promotionCandidates?: Assertion[];
  prices?: Observation[];
  yields?: Observation[];
  evidence?: Evidence[];
  conflicts?: Conflict[];
  integrationErrors?: IntegrationError[];
};

const dateLabel = (value: string) => new Date(value).toLocaleString("es-PE");

export function KnowledgeReviewPanel({ items, resources, assertions = [], promotionCandidates = [], prices = [], yields = [], evidence = [], conflicts = [], integrationErrors = [] }: Props) {
  const [message, setMessage] = useState("");
  const [alias, setAlias] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [scope, setScope] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(query);
  const filteredAssertions = assertions.filter((row) => (status === "ALL" || row.status === status) && (scope === "ALL" || row.scope === scope) && `${row.subjectType} ${row.subjectId} ${row.predicate}`.toLowerCase().includes(query));
  const filteredConflicts = conflicts.filter((row) => (status === "ALL" || row.status === status) && matches(`${row.assertionId} ${row.conflictingAssertionId} ${row.reason}`));
  const filteredErrors = integrationErrors.filter((row) => matches(`${row.status} ${row.errorCode ?? ""} ${row.errorMessage ?? ""} ${row.jobType ?? ""}`));

  async function confirmAlias(kind: "items" | "resources", id: string) {
    const value = alias[id]?.trim();
    if (!value) {
      setMessage("Escribe un alias antes de confirmarlo.");
      return;
    }
    const response = await fetch(`/api/knowledge/${kind}/${id}/aliases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alias: value }) });
    const payload = await response.json() as { error?: string };
    setMessage(response.ok ? "Alias confirmado." : payload.error ?? "No se pudo confirmar el alias.");
    if (response.ok) setAlias((current) => ({ ...current, [id]: "" }));
  }

  async function transition(row: Assertion, nextStatus: "CONFIRMED" | "REJECTED" | "DEPRECATED" | "CANONICAL", promotionScope?: "COMPANY" | "GLOBAL") {
    const reason = nextStatus === "REJECTED" || nextStatus === "DEPRECATED" ? window.prompt("Motivo obligatorio")?.trim() : undefined;
    if ((nextStatus === "REJECTED" || nextStatus === "DEPRECATED") && !reason) return;
    if (nextStatus === "CANONICAL" && (promotionScope ?? "GLOBAL") === "GLOBAL" && !window.confirm("La promoción GLOBAL requiere MFA y no modifica presupuestos. ¿Continuar?")) return;
    setBusy(row.id);
    try {
      const response = await fetch(`/api/admin/knowledge/assertions/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ nextStatus, promotionScope, reviewDecisionId: nextStatus === "CANONICAL" ? row.reviewDecisionId : undefined, companyId: row.companyId, projectId: row.projectId ?? undefined, rejectionReason: reason, correlationId: crypto.randomUUID() }) });
      const payload = await response.json() as { error?: string };
      setMessage(response.ok ? `Assertion ${nextStatus.toLowerCase()} registrada.` : payload.error ?? "No se pudo actualizar la assertion.");
    } catch {
      setMessage("No se pudo conectar con la acción administrativa.");
    } finally {
      setBusy(null);
    }
  }

  async function correctAssertion(row: Assertion) {
    const rawValue = window.prompt("Nuevo valor JSON", JSON.stringify(row.value ?? {}));
    if (!rawValue) return;
    let value: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawValue);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("object required");
      value = parsed as Record<string, unknown>;
    } catch {
      setMessage("El nuevo valor debe ser un objeto JSON válido.");
      return;
    }
    const reason = window.prompt("Motivo de corrección")?.trim();
    if (!reason || !row.companyId || !row.projectId) return;
    setBusy(row.id);
    try {
      const response = await fetch(`/api/admin/knowledge/import-learning?assertionId=${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId: row.companyId, projectId: row.projectId, value, reason, correlationId: crypto.randomUUID() }) });
      const payload = await response.json() as { error?: string };
      setMessage(response.ok ? "Corrección registrada para nueva revisión." : payload.error ?? "No se pudo corregir la assertion.");
    } catch {
      setMessage("No se pudo conectar con la corrección administrativa.");
    } finally {
      setBusy(null);
    }
  }
  async function resolveConflict(row: Conflict) {
    const reason = window.prompt("Motivo de resolución")?.trim();
    if (!reason) return;
    setBusy(row.id);
    try {
      const response = await fetch(`/api/admin/knowledge/conflicts/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId: row.companyId, projectId: row.projectId ?? undefined, resolution: "RESOLVED", reason, correlationId: crypto.randomUUID() }) });
      const payload = await response.json() as { error?: string };
      setMessage(response.ok ? "Conflicto resuelto." : payload.error ?? "No se pudo resolver el conflicto.");
    } finally {
      setBusy(null);
    }
  }

  async function retry(row: IntegrationError) {
    setBusy(row.id);
    try {
      const response = await fetch(`/api/admin/knowledge/jobs/${row.id}/retry`, { method: "POST" });
      setMessage(response.ok ? "Retry solicitado." : "No se pudo solicitar el retry.");
    } finally {
      setBusy(null);
    }
  }

  const renderCandidates = (kind: "items" | "resources", rows: Candidate[]) => rows.map((row) => (
    <div key={row.id} className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.scope} · {row.aliases.length} aliases</p></div>
      <div className="flex gap-2"><input aria-label={`Alias para ${row.name}`} value={alias[row.id] ?? ""} onChange={(event) => setAlias((current) => ({ ...current, [row.id]: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Alias confirmado" /><button type="button" onClick={() => void confirmAlias(kind, row.id)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Confirmar</button></div>
    </div>
  ));

  return <section className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Filtros administrativos</h2><div className="mt-3 flex flex-wrap gap-3"><input aria-label="Buscar en Knowledge" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Buscar entidad, predicate o error" /><select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="ALL">Todos los estados</option>{["OBSERVED", "REVIEW_REQUIRED", "CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED", "OPEN", "RESOLVED", "DISMISSED"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filtrar por scope" value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="ALL">Todos los scopes</option><option value="PROJECT">PROJECT</option><option value="COMPANY">COMPANY</option><option value="GLOBAL">GLOBAL</option></select></div></div>
    <div className="grid gap-5 lg:grid-cols-2"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Partidas candidatas</h2>{renderCandidates("items", items)}</div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Recursos candidatos</h2>{renderCandidates("resources", resources)}</div></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Assertions ({filteredAssertions.length})</h2>{filteredAssertions.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm"><div><p className="font-medium">{row.subjectType} · {row.predicate}</p><p className="text-xs text-slate-500">{row.subjectId} · {row.scope} · {row.confidence} · {dateLabel(row.updatedAt)} {row.evidenceId ? `· evidencia ${row.evidenceId}` : "· sin evidencia"}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy === row.id} onClick={() => void correctAssertion(row)} className="rounded-lg border px-2 py-1 text-xs">Corregir</button><button disabled={busy === row.id} onClick={() => void transition(row, "CONFIRMED")} className="rounded-lg border px-2 py-1 text-xs">Confirmar</button><button disabled={busy === row.id} onClick={() => void transition(row, "REJECTED")} className="rounded-lg border px-2 py-1 text-xs">Rechazar</button><button disabled={busy === row.id} onClick={() => void transition(row, "DEPRECATED")} className="rounded-lg border px-2 py-1 text-xs">Deprecar</button></div></div>)}</section>
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Promotion candidates ({promotionCandidates.length})</h2>{promotionCandidates.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 text-sm"><span>{row.subjectType} · {row.subjectId} · VERIFIED</span><div className="flex gap-2"><button disabled={busy === row.id} onClick={() => void transition(row, "CANONICAL", "COMPANY")} className="rounded-lg border border-amber-500 px-3 py-1 text-xs font-medium text-amber-700">Promover COMPANY</button><button disabled={busy === row.id} onClick={() => void transition(row, "CANONICAL", "GLOBAL")} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white">Promover GLOBAL</button></div></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-2"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Observaciones ({prices.length + yields.length})</h2>{[...prices, ...yields].filter((row) => matches(`${row.id} ${row.unit} ${row.scope} ${row.confidence}`)).map((row) => <div key={row.id} className="border-t border-slate-100 px-5 py-3 text-sm"><p className="font-medium">{row.value} {row.unit} · {row.scope}</p><p className="text-xs text-slate-500">{row.confidence} · {dateLabel(row.observedAt)} {row.evidenceId ? `· evidencia ${row.evidenceId}` : "· sin evidencia primaria"}</p></div>)}</section><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Evidence / provenance ({evidence.length})</h2>{evidence.filter((row) => matches(`${row.id} ${row.fileName ?? ""} ${row.sourceId}`)).map((row) => <a key={row.id} href={`/api/admin/knowledge/evidence/${row.id}`} className="block border-t border-slate-100 px-5 py-3 text-sm hover:bg-slate-50"><p className="font-medium">{row.fileName ?? row.documentId ?? row.id}</p><p className="text-xs text-slate-500">source {row.sourceId} · {row.page ? `p. ${row.page}` : ""} {row.sheet ? `· hoja ${row.sheet}` : ""} {row.cellRange ? `· celda ${row.cellRange}` : ""} · {dateLabel(row.createdAt)}</p></a>)}</section></div>
    <div className="grid gap-5 lg:grid-cols-2"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Conflictos ({filteredConflicts.length})</h2>{filteredConflicts.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm"><span>{row.assertionId} vs {row.conflictingAssertionId} · {row.status}<br /><small className="text-slate-500">{row.reason}</small></span>{row.status === "OPEN" ? <button disabled={busy === row.id} onClick={() => void resolveConflict(row)} className="rounded-lg border px-2 py-1 text-xs">Resolver</button> : null}</div>)}</section><section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Integration errors ({filteredErrors.length})</h2>{filteredErrors.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm"><span>{row.jobType === "IMPORT_LEARNING" ? "Import learning" : "Review learning"} · {row.errorCode ?? "ERROR"} · intento {row.attemptCount}<br /><small className="text-slate-500">{row.errorMessage ?? row.status}</small></span><button disabled={busy === row.id} onClick={() => void retry(row)} className="rounded-lg border px-2 py-1 text-xs">Retry</button></div>)}</section></div>
    {message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
  </section>;
}
