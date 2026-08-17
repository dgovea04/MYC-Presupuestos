"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, History, Loader2, RotateCcw, Save, Search, Upload, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocalResourcePriceBatchItemRecord, LocalResourcePriceBatchSummary } from "@/types/local-resource-pricing";

type AdminResource = { id: string; code: string; description: string; unit: string; currency: string; unitPrice: string; priceUpdatedAt: string | null; priceSource: string | null };
type BatchDetail = { batch: LocalResourcePriceBatchSummary; items: LocalResourcePriceBatchItemRecord[] };
type BatchCreationResponse = BatchDetail & { reused?: boolean };
type ResourceHistory = { resource: { id: string; code: string; description: string; unit: string; currency: string; unitPrice: string }; history: Array<{ id: string; batchId: string; versionLabel: string; batchStatus: string; oldPrice: string; newPrice: string; changedById: string; changedAt: string }> };
type ConfirmationAction = "publish" | "reject" | "rollback";
type PendingConfirmation = { action: ConfirmationAction; batch: LocalResourcePriceBatchSummary };

export function LocalResourcePriceAdminPanel({ canManage, mfaEnabled }: { canManage: boolean; mfaEnabled: boolean }) {
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [batches, setBatches] = useState<LocalResourcePriceBatchSummary[]>([]);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BatchDetail | null>(null);
  const [resourceHistory, setResourceHistory] = useState<ResourceHistory | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleResources = useMemo(() => resources.filter((resource) => {
    const normalized = query.trim().toLowerCase();
    return !normalized || resource.code.toLowerCase().includes(normalized) || resource.description.toLowerCase().includes(normalized);
  }), [resources, query]);

  async function load() {
    try {
      const [resourceResponse, batchResponse] = await Promise.all([
        fetch("/api/admin/resource-prices/local/resources", { cache: "no-store" }),
        fetch("/api/admin/resource-prices/local?limit=50", { cache: "no-store" }),
      ]);
      const resourcePayload = (await resourceResponse.json()) as { resources?: AdminResource[]; error?: string };
      const batchPayload = (await batchResponse.json()) as { batches?: LocalResourcePriceBatchSummary[]; error?: string };
      if (!resourceResponse.ok || !batchResponse.ok) {
        if (resourceResponse.status === 403 || batchResponse.status === 403) {
          throw new Error("Verifica MFA en Seguridad para habilitar el catálogo local. La validación dura 10 minutos.");
        }
        throw new Error(resourcePayload.error ?? batchPayload.error ?? "No se pudo cargar el catálogo local.");
      }
      setResources(resourcePayload.resources ?? []);
      setBatches(batchPayload.batches ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el catálogo local.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage && mfaEnabled) void Promise.resolve().then(() => load());
  }, [canManage, mfaEnabled]);

  function setDraft(resourceId: string, value: string) {
    setDraftPrices((current) => ({ ...current, [resourceId]: value }));
  }

  async function createManualPreview() {
    const rows = resources.flatMap((resource) => {
      const value = draftPrices[resource.id];
      return value === undefined || value === resource.unitPrice ? [] : [{ resourceId: resource.id, code: resource.code, description: resource.description, unit: resource.unit, currency: resource.currency, proposedPrice: value, sourceLabel: "Tabla administrativa MC Presupuestos" }];
    });
    if (rows.length === 0) {
      setError("No hay cambios manuales pendientes.");
      return;
    }
    await runAction(async () => {
      const response = await fetch("/api/admin/resource-prices/local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, notes: "Actualización creada desde la tabla administrativa." }) });
      const payload = (await response.json()) as BatchDetail | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error ?? "No se pudo crear el preview." : "No se pudo crear el preview.");
      setDraftPrices({});
      setMessage("Preview manual creado. Revísalo antes de publicar.");
      await load();
    });
  }

  async function importWorkbook(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    await runAction(async () => {
      const response = await fetch("/api/admin/resource-prices/local/import", { method: "POST", body: formData });
      const payload = (await response.json()) as BatchCreationResponse | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error ?? "No se pudo importar el Excel." : "No se pudo importar el Excel.");
      setMessage("reused" in payload && payload.reused ? "Este Excel ya había sido importado. Se reutilizó el preview existente." : "Excel importado como preview. Ningún precio fue publicado.");
      await load();
    });
  }

  async function openBatch(id: string) {
    const response = await fetch(`/api/admin/resource-prices/local/${id}`, { cache: "no-store" });
    const payload = (await response.json()) as BatchDetail | { error?: string };
    if (!response.ok || !("batch" in payload)) throw new Error("error" in payload ? payload.error ?? "No se pudo abrir el lote." : "No se pudo abrir el lote.");
    setSelected(payload);
  }

  async function openResourceHistory(resourceId: string) {
    await runAction(async () => {
      const response = await fetch(`/api/admin/resource-prices/local/history/${resourceId}`, { cache: "no-store" });
      const payload = (await response.json()) as ResourceHistory | { error?: string };
      if (!response.ok || !("history" in payload)) throw new Error("error" in payload ? payload.error ?? "No se pudo cargar el historial." : "No se pudo cargar el historial.");
      setResourceHistory(payload);
    });
  }

  function requestConfirmation(action: ConfirmationAction, batch: LocalResourcePriceBatchSummary) {
    setPendingConfirmation({ action, batch });
  }

  async function publish(batch: LocalResourcePriceBatchSummary) {
    await runAction(async () => {
      const response = await fetch(`/api/admin/resource-prices/local/${batch.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmVersion: batch.versionLabel }) });
      const payload = (await response.json()) as { batch?: LocalResourcePriceBatchSummary; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo publicar el lote.");
      setMessage(`Versión ${batch.versionLabel} publicada.`);
      setSelected(null);
      await load();
    });
  }

  async function confirmPendingAction() {
    if (!pendingConfirmation) return;

    const { action, batch } = pendingConfirmation;
    setPendingConfirmation(null);

    if (action === "publish") {
      await publish(batch);
    } else if (action === "reject") {
      await reject(batch);
    } else {
      await rollback(batch);
    }
  }

  async function reject(batch: LocalResourcePriceBatchSummary) {
    await runAction(async () => {
      const response = await fetch(`/api/admin/resource-prices/local/${batch.id}/reject`, { method: "POST" });
      const payload = (await response.json()) as { batch?: LocalResourcePriceBatchSummary; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo rechazar el lote.");
      setMessage(`Versión ${batch.versionLabel} rechazada.`);
      setSelected(null);
      await load();
    });
  }

  async function rollback(batch: LocalResourcePriceBatchSummary) {
    await runAction(async () => {
      const response = await fetch(`/api/admin/resource-prices/local/${batch.id}/rollback`, { method: "POST" });
      const payload = (await response.json()) as { batch?: LocalResourcePriceBatchSummary; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo revertir la versión.");
      setMessage(`Rollback de ${batch.versionLabel} creado y publicado.`);
      await load();
    });
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await action(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "No se pudo completar la acción."); } finally { setBusy(false); }
  }

  if (!canManage) {
    return <section className="theme-surface-card rounded-2xl border p-6"><p className="theme-strong-text font-semibold">Catálogo local de precios</p><p className="theme-muted-text mt-2 text-sm">Solo el SUPER_ADMIN puede importar, editar, publicar o revertir precios globales.</p></section>;
  }

  if (!mfaEnabled) {
    return <section className="theme-surface-card rounded-2xl border p-6"><p className="theme-strong-text font-semibold">Catálogo local de precios</p><p className="theme-muted-text mt-2 text-sm">Activa MFA desde Seguridad antes de acceder al catálogo global. Las operaciones de precios requieren una validación MFA reciente.</p><a href="/admin?adminTab=security" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:underline">Ir a Seguridad y configurar MFA</a></section>;
  }

  return (
    <section className="theme-surface-card rounded-2xl border p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><History className="h-5 w-5 text-sky-600" aria-hidden="true" /><h2 className="theme-strong-text text-lg font-semibold">Catálogo local versionado</h2></div>
          <p className="theme-muted-text mt-1 max-w-3xl text-sm">Edita o importa precios como borrador. El catálogo global solo cambia al publicar un preview y cada publicación conserva historial para rollback.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkbook(file); event.target.value = ""; }} />
          <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => { window.location.href = "/api/admin/resource-prices/local/export"; }}><Download className="h-4 w-4" />Exportar catálogo actual</Button>
          <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => { window.location.href = "/api/admin/resource-prices/local/template"; }}><Download className="h-4 w-4" />Descargar plantilla</Button>
          <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" />Importar Excel</Button>
          <Button type="button" className="gap-2" disabled={busy || Object.keys(draftPrices).length === 0} onClick={() => void createManualPreview()}><Save className="h-4 w-4" />Crear preview manual</Button>
        </div>
      </div>

      {loading ? <p className="theme-muted-text mt-6 text-sm">Cargando catálogo local...</p> : (
        <div className="mt-6 space-y-6">
          {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm"><XCircle className="mr-2 inline h-4 w-4" />{error} <a href="/admin?adminTab=security" className="ml-1 font-medium underline">Ir a Seguridad y MFA</a></p> : null}
          {message ? <p className="theme-status-success rounded-xl border px-3 py-2 text-sm">{message}</p> : null}
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-3">
              <div className="relative"><Search className="theme-muted-text absolute left-3 top-2.5 h-4 w-4" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código o descripción..." className="pl-9" aria-label="Buscar insumos globales" /></div>
              <div className="theme-surface-card max-h-[32rem] overflow-auto rounded-2xl border">
                <div className="theme-muted-panel sticky top-0 grid grid-cols-[1fr_8rem_7rem] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide"><span>Insumo</span><span>Precio actual</span><span>Nuevo precio</span></div>
                {visibleResources.length === 0 ? <p className="theme-muted-text px-4 py-8 text-center text-sm">No se encontraron insumos.</p> : visibleResources.map((resource) => <div key={resource.id} className="grid grid-cols-[1fr_8rem_7rem] items-center gap-3 border-b px-4 py-2.5 last:border-b-0"><div className="min-w-0"><p className="theme-strong-text truncate text-sm font-medium">{resource.code} · {resource.description}</p><p className="theme-muted-text text-xs">{resource.unit} · {resource.currency}</p><button type="button" className="mt-1 text-xs font-medium text-sky-700 hover:underline" onClick={() => void openResourceHistory(resource.id)}>Ver historial</button></div><span className="theme-muted-text text-sm">{resource.unitPrice}</span><Input aria-label={`Nuevo precio para ${resource.code}`} inputMode="decimal" value={draftPrices[resource.id] ?? resource.unitPrice} onChange={(event) => setDraft(resource.id, event.target.value)} className="h-8 text-right text-sm" /></div>)}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="theme-strong-text font-semibold">Historial de versiones</h3>
              <div className="space-y-2">
                {batches.length === 0 ? <p className="theme-muted-text rounded-xl border border-dashed px-4 py-6 text-sm">Todavía no hay lotes locales.</p> : batches.map((batch) => <div key={batch.id} className="theme-muted-panel rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><button type="button" className="text-left" onClick={() => void openBatch(batch.id)}><p className="theme-strong-text text-sm font-semibold">{batch.versionLabel}</p><p className="theme-muted-text text-xs">{sourceLabel(batch.source)} · {statusLabel(batch.status)}</p><p className="theme-muted-text mt-1 text-xs">{batch.changedRows} cambios · {batch.invalidRows} inválidas</p></button>{batch.status === "PREVIEW_READY" ? <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => requestConfirmation("reject", batch)} disabled={busy}>Rechazar</Button><Button size="sm" onClick={() => requestConfirmation("publish", batch)} disabled={busy}>Publicar</Button></div> : batch.status === "PUBLISHED" ? <Button size="sm" variant="outline" className="gap-1" onClick={() => requestConfirmation("rollback", batch)} disabled={busy}><RotateCcw className="h-3 w-3" />Rollback</Button> : null}</div></div>)}
              </div>
            </div>
          </div>
          {selected ? <BatchDetailPanel detail={selected} onClose={() => setSelected(null)} /> : null}
          {resourceHistory ? <ResourceHistoryPanel detail={resourceHistory} onClose={() => setResourceHistory(null)} /> : null}
        </div>
      )}

      <PriceActionConfirmationDialog
        pendingConfirmation={pendingConfirmation}
        busy={busy}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => void confirmPendingAction()}
      />
    </section>
  );
}

function PriceActionConfirmationDialog({
  pendingConfirmation,
  busy,
  onCancel,
  onConfirm,
}: {
  pendingConfirmation: PendingConfirmation | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const action = pendingConfirmation?.action;
  const batch = pendingConfirmation?.batch;
  const copy = action ? getConfirmationCopy(action) : null;

  return (
    <Dialog.Root open={pendingConfirmation !== null} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">
                {copy?.title ?? "Confirmar acción"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                {batch ? copy?.description(batch.versionLabel) : "Selecciona una acción para continuar."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Cerrar"
                disabled={busy}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="theme-status-warning mt-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{copy?.warning}</p>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={busy}>Cancelar</Button>
            </Dialog.Close>
            <Button type="button" variant={action === "reject" ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? "Procesando..." : copy?.confirmLabel ?? "Confirmar"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function getConfirmationCopy(action: ConfirmationAction) {
  if (action === "publish") {
    return {
      title: "Publicar versión de precios",
      description: (versionLabel: string) => `¿Publicar la versión ${versionLabel}? Esta acción actualizará el catálogo global.`,
      warning: "Los precios se aplicarán al catálogo global, pero no modificarán directamente los precios materializados de presupuestos ni APUs existentes.",
      confirmLabel: "Publicar versión",
    };
  }

  if (action === "reject") {
    return {
      title: "Rechazar preview de precios",
      description: (versionLabel: string) => `¿Rechazar la versión ${versionLabel}? El preview quedará registrado sin publicar cambios.`,
      warning: "El lote quedará rechazado y no podrá publicarse como está. Los datos permanecerán disponibles para auditoría.",
      confirmLabel: "Rechazar preview",
    };
  }

  return {
    title: "Crear rollback de precios",
    description: (versionLabel: string) => `¿Revertir la versión ${versionLabel}? Se creará una nueva versión de rollback.`,
    warning: "El rollback publicará una nueva versión con los precios anteriores y conservará la trazabilidad del cambio.",
    confirmLabel: "Crear rollback",
  };
}

function BatchDetailPanel({ detail, onClose }: { detail: BatchDetail; onClose: () => void }) {
  return <div className="theme-muted-panel rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="theme-strong-text font-semibold">Preview {detail.batch.versionLabel}</h3><p className="theme-muted-text text-sm">Revisa cada fila antes de publicar.</p></div><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cerrar</Button></div><div className="mt-4 max-h-80 overflow-auto rounded-xl border"><div className="theme-muted-panel grid grid-cols-[1fr_7rem_7rem_7rem] gap-3 px-3 py-2 text-xs font-semibold uppercase"><span>Insumo</span><span>Actual</span><span>Propuesto</span><span>Estado</span></div>{detail.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_7rem_7rem_7rem] gap-3 border-t px-3 py-2 text-xs"><span>{item.resourceCode} · {item.resourceDescription}</span><span>{item.oldPrice ?? "—"}</span><span>{item.proposedPrice ?? "—"}</span><span>{item.status}{item.reason ? ` · ${item.reason}` : ""}</span></div>)}</div></div>;
}

function ResourceHistoryPanel({ detail, onClose }: { detail: ResourceHistory; onClose: () => void }) {
  return <div className="theme-muted-panel rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="theme-strong-text font-semibold">Historial · {detail.resource.code}</h3><p className="theme-muted-text text-sm">{detail.resource.description} · precio actual {detail.resource.unitPrice} {detail.resource.currency}</p></div><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cerrar</Button></div>{detail.history.length === 0 ? <p className="theme-muted-text mt-4 rounded-xl border border-dashed px-3 py-5 text-sm">Este insumo todavía no tiene cambios locales publicados.</p> : <div className="mt-4 overflow-auto rounded-xl border"><div className="theme-muted-panel grid grid-cols-[8rem_7rem_7rem_1fr] gap-3 px-3 py-2 text-xs font-semibold uppercase"><span>Versión</span><span>Anterior</span><span>Nuevo</span><span>Fecha</span></div>{detail.history.map((entry) => <div key={entry.id} className="grid grid-cols-[8rem_7rem_7rem_1fr] gap-3 border-t px-3 py-2 text-xs"><span>{entry.versionLabel}</span><span>{entry.oldPrice}</span><span>{entry.newPrice}</span><span>{new Date(entry.changedAt).toLocaleString("es-PE")} · {entry.batchStatus}</span></div>)}</div>}</div>;
}

function sourceLabel(source: LocalResourcePriceBatchSummary["source"]) { return source === "EXCEL" ? "Excel" : source === "MANUAL" ? "Tabla" : "Rollback"; }
function statusLabel(status: LocalResourcePriceBatchSummary["status"]) { return status === "PREVIEW_READY" ? "Preview" : status === "PUBLISHED" ? "Publicado" : status === "ROLLED_BACK" ? "Revertido" : status === "REJECTED" ? "Rechazado" : "Borrador"; }
