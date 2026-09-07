"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { ReviewDocumentView } from "./types";

const categories = ["PLAN", "TECHNICAL_SPECIFICATION", "QUANTITY_TAKEOFF", "BUDGET", "APU", "OTHER"] as const;
const categoryLabels: Record<(typeof categories)[number], string> = { PLAN: "Planos", TECHNICAL_SPECIFICATION: "Especificación técnica", QUANTITY_TAKEOFF: "Metrados", BUDGET: "Presupuesto", APU: "APU", OTHER: "Otro" };

export function DocumentManager({ projectId, documents, selectedDocumentIds = [], selectedSheetNames = [], onSelectionChange, onSheetSelectionChange, onChanged }: { projectId: string; documents: ReviewDocumentView[]; selectedDocumentIds?: string[]; selectedSheetNames?: string[]; onSelectionChange?: (ids: string[]) => void; onSheetSelectionChange?: (names: string[]) => void; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadKey = useRef<string | null>(null);
  const targetDocumentId = useRef<string | null>(null);
  const [category, setCategory] = useState<(typeof categories)[number]>("OTHER");
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ReviewDocumentView | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true); setError(null);
    const formData = new FormData();
    formData.set("file", file); formData.set("category", category); formData.set("name", file.name); if (targetDocumentId.current) formData.set("documentId", targetDocumentId.current);
    try {
      const key = uploadKey.current ?? (uploadKey.current = `review-upload-${crypto.randomUUID()}`);
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-documents`, { method: "POST", headers: { "Idempotency-Key": key }, body: formData });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "No se pudo cargar el documento.");
      onChanged(); uploadKey.current = null; targetDocumentId.current = null;
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No se pudo cargar el documento."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function clearDocuments() {
    setClearDialogOpen(false); setClearing(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-documents`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ELIMINAR DOCUMENTOS FUENTE" }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "No se pudieron eliminar los documentos fuente.");
      onSelectionChange?.([]); onChanged();
    } catch (clearError) { setError(clearError instanceof Error ? clearError.message : "No se pudieron eliminar los documentos fuente."); }
    finally { setClearing(false); }
  }

  async function deleteDocument() {
    if (!documentToDelete) return;
    setDeletingDocument(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-documents/${encodeURIComponent(documentToDelete.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "No se pudo eliminar el documento fuente.");
      onSelectionChange?.(selectedDocumentIds.filter((id) => id !== documentToDelete.id)); setDocumentToDelete(null); onChanged();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el documento fuente."); }
    finally { setDeletingDocument(false); }
  }

  async function reprocess(document: ReviewDocumentView, selection: { pages?: number[]; worksheets?: string[] }) {
    const version = document.currentVersion;
    if (!version) return;
    const target = selection.pages?.[0] ?? selection.worksheets?.[0] ?? "";
    setReprocessing(`${document.id}:${target}`); setError(null);
    try {
      const response = await fetch(`/api/review-documents/${encodeURIComponent(document.id)}/reprocess`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection) });
      const payload = await response.json().catch(() => null) as { error?: unknown; warnings?: unknown } | null;
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "No se pudo reprocesar la cobertura.");
      const warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter((warning): warning is string => typeof warning === "string") : [];
      if (warnings.length > 0) setError(warnings.join(" "));
      onChanged();
    } catch (reprocessError) { setError(reprocessError instanceof Error ? reprocessError.message : "No se pudo reprocesar la cobertura."); }
    finally { setReprocessing(null); }
  }

  function reprocessPending(document: ReviewDocumentView) {
    const version = document.currentVersion;
    if (!version) return;
    const isPdf = version.mimeType.includes("pdf") || document.originalFileName.toLowerCase().endsWith(".pdf");
    const pages = version.extractionCoverage?.flatMap((entry) => entry.page !== undefined && entry.coverage !== "PROCESSED" ? [entry.page] : []) ?? [];
    const worksheets = version.extractionCoverage?.flatMap((entry) => entry.worksheet && entry.coverage !== "PROCESSED" ? [entry.worksheet] : []) ?? [];
    if (isPdf ? pages.length === 0 : worksheets.length === 0) return;
    void reprocess(document, isPdf ? { pages } : { worksheets });
  }

  function toggleDocument(id: string) {
    onSelectionChange?.(selectedDocumentIds.includes(id) ? selectedDocumentIds.filter((value) => value !== id) : [...selectedDocumentIds, id]);
  }

  function toggleSheet(sheetName: string) {
    onSheetSelectionChange?.(selectedSheetNames.includes(sheetName) ? selectedSheetNames.filter((value) => value !== sheetName) : [...selectedSheetNames, sheetName]);
  }

  return <Card id="review-document-manager" className="theme-surface-card" data-testid="review-document-manager">
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Documentos fuente</CardTitle><p className="mt-1 text-sm text-[var(--app-text-muted)]">PDF/XLSX versionados, sin ejecutar macros, scripts ni enlaces embebidos.</p></div><div className="flex flex-wrap items-center justify-end gap-2"><label htmlFor="review-document-category" className="sr-only">Categoría del documento</label><Select id="review-document-category" aria-label="Categoría del documento" value={category} className="w-52 shrink-0" onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}>{categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}</Select><input ref={inputRef} type="file" accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Archivo PDF o XLSX" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><Button type="button" onClick={() => inputRef.current?.click()} loading={uploading} aria-label="Cargar documento PDF o XLSX"><Upload className="h-4 w-4" aria-hidden="true" />Cargar documento</Button><Button type="button" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50 sm:ml-auto" onClick={() => setClearDialogOpen(true)} loading={clearing} disabled={documents.length === 0} aria-label="Eliminar documentos fuente"><Trash2 className="h-4 w-4" aria-hidden="true" />Limpiar fuentes</Button></div></CardHeader>
    <CardContent className="space-y-3">{error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}{documents.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">Todavía no hay documentos asociados a este proyecto.</p> : null}{documents.map((document) => <DocumentRow key={document.id} document={document} selected={selectedDocumentIds.includes(document.id)} selectedSheetNames={selectedSheetNames} onToggle={() => toggleDocument(document.id)} onToggleSheet={toggleSheet} onClassified={onChanged} onReprocess={(selection) => void reprocess(document, selection)} onReprocessPending={() => reprocessPending(document)} reprocessing={reprocessing} onReplace={() => { targetDocumentId.current = document.id; inputRef.current?.click(); }} onDelete={() => setDocumentToDelete(document)} />)}</CardContent>
    <AlertDialog open={clearDialogOpen} title="Limpiar documentos fuente" description="Esta acción eliminará todos los documentos fuente, sus versiones, evidencias y revisiones del proyecto. El presupuesto y sus APU se conservarán." confirmLabel="Sí, limpiar fuentes" onConfirm={() => void clearDocuments()} onCancel={() => setClearDialogOpen(false)} />
    <AlertDialog open={documentToDelete !== null} title="Eliminar documento fuente" description={documentToDelete ? `Se eliminará “${documentToDelete.name}”, todas sus versiones y la evidencia asociada. Las revisiones relacionadas quedarán obsoletas.` : ""} confirmLabel={deletingDocument ? "Eliminando…" : "Sí, eliminar documento"} onConfirm={() => void deleteDocument()} onCancel={() => { if (!deletingDocument) setDocumentToDelete(null); }} />
    <style>{`
      #review-document-manager > div:first-child {
        gap: 1rem;
      }

      #review-document-manager > div:first-child > div:last-child {
        display: grid;
        gap: 0.5rem;
      }

      #review-document-manager .flex.items-center.justify-end.gap-2 {
        width: 100%;
        flex-wrap: wrap;
      }

      #review-document-manager .flex.flex-col.gap-3.rounded-xl.border {
        display: grid;
        gap: 1rem;
        flex-direction: column;
        align-items: stretch;
        overflow: hidden;
        padding: 1rem;
      }

      #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > div:first-child {
        min-width: 0;
      }

      #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > div:nth-child(2) {
        justify-content: flex-start;
        border-top: 1px solid var(--app-border);
        padding-top: 0.75rem;
      }

      #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > fieldset {
        width: 100%;
      }

      #review-document-manager .flex.max-w-md.items-start {
        max-width: none;
      }

      #review-document-manager select {
        width: 100%;
      }

      @media (min-width: 640px) {
        #review-document-manager .flex.items-center.justify-end.gap-2 {
          width: auto;
        }

        #review-document-manager .flex.flex-col.gap-3.rounded-xl.border {
          grid-template-columns: minmax(0, 1fr) auto;
          flex-direction: column;
          align-items: stretch;
        }

        #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > div:first-child {
          grid-column: 1;
        }

        #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > div:nth-child(2) {
          grid-column: 2;
          align-self: start;
          border-top: 0;
          padding-top: 0;
        }

        #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > :nth-child(n + 3) {
          grid-column: 1 / -1;
        }

        #review-document-manager .flex.flex-col.gap-3.rounded-xl.border > div:nth-child(2) {
          justify-content: flex-end;
        }

        #review-document-manager > div:first-child > div:last-child {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        #review-document-manager select {
          width: 13rem;
        }
      }
    `}</style>
  </Card>;
}

function DocumentRow({ document, selected, selectedSheetNames, onToggle, onToggleSheet, onClassified, onReprocess, onReprocessPending, reprocessing, onReplace, onDelete }: { document: ReviewDocumentView; selected: boolean; selectedSheetNames: string[]; onToggle: () => void; onToggleSheet: (sheetName: string) => void; onClassified: () => void; onReprocess: (selection: { pages?: number[]; worksheets?: string[] }) => void; onReprocessPending: () => void; reprocessing: string | null; onReplace: () => void; onDelete: () => void }) {
  const version = document.currentVersion;
  const isPdf = version?.mimeType.includes("pdf") || document.originalFileName.toLowerCase().endsWith(".pdf");
  const detail = version ? `${isPdf ? "PDF" : "XLSX"} · versión ${version.versionNumber} · ${isPdf ? `${version.pageCount ?? "—"} páginas` : `${version.sheetCount ?? "—"} hojas`}` : "Sin versión procesable";
  return <div className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Incluir ${document.name} en la revisión`} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" /><span className="rounded-lg bg-[var(--app-surface-muted)] p-2 text-[var(--app-primary-soft)]">{isPdf ? <FileText className="h-5 w-5" aria-hidden="true" /> : <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}</span><div className="min-w-0"><p className="truncate font-medium text-[var(--app-text-strong)]">{document.name}</p><p className="text-xs text-[var(--app-text-muted)]">{detail}</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">{categoryLabels[document.category as (typeof categories)[number]] ?? document.category} · Estado: {document.status}</p></div></div>
    <div className="flex items-center justify-end gap-2"><label className="sr-only" htmlFor={`classification-${document.id}`}>Clasificación de {document.name}</label><Select id={`classification-${document.id}`} aria-label={`Clasificar ${document.name}`} value={document.category} className="w-52 shrink-0" onChange={(event) => { void fetch(`/api/review-documents/${encodeURIComponent(document.id)}/classification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: event.target.value }) }).then((response) => { if (!response.ok) throw new Error("classification"); onClassified(); }).catch(() => undefined); }}>{categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}</Select>{document.classificationSuggestion && document.classificationSuggestion.category !== document.category ? <button type="button" className="text-xs font-medium text-sky-700 underline underline-offset-2" onClick={() => { void fetch(`/api/review-documents/${encodeURIComponent(document.id)}/classification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: document.classificationSuggestion?.category }) }).then((response) => { if (!response.ok) throw new Error("classification"); onClassified(); }).catch(() => undefined); }}>Usar sugerencia: {categoryLabels[document.classificationSuggestion.category]}</button> : null}<button type="button" onClick={onReplace} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--app-text-strong)] transition-colors hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70">Reemplazar versión</button><button type="button" onClick={onDelete} aria-label={`Eliminar ${document.name}`} title="Eliminar documento fuente" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-[var(--app-surface)] text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>
    {!isPdf && version?.sheetNames?.length ? <fieldset className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3"><legend className="px-1 text-xs font-medium text-[var(--app-text-strong)]">Hojas XLSX para la revisión (sin selección: todas)</legend><div className="mt-2 flex flex-wrap gap-3">{version.sheetNames.map((sheetName) => <label key={sheetName} className="flex items-center gap-2 text-xs text-[var(--app-text-strong)]"><input type="checkbox" checked={selectedSheetNames.includes(sheetName)} onChange={() => onToggleSheet(sheetName)} aria-label={`Incluir hoja ${sheetName} de ${document.name}`} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />{sheetName}</label>)}</div></fieldset> : null}
    {document.classificationSuggestion ? <p aria-label={`Señales de clasificación de ${document.name}`} className="text-xs text-[var(--app-text-muted)]">Señales que sustentan la sugerencia: {document.classificationSuggestion.signals.join(" · ")}</p> : null}
    {document.warnings.length > 0 ? <div className="flex max-w-md items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><ul className="list-disc pl-3">{document.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
    {document.currentVersion?.extractionCoverage?.some((entry) => entry.coverage !== "PROCESSED") ? <button type="button" onClick={onReprocessPending} aria-label={`Reprocesar cobertura de ${document.name}`} className="self-start rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70">Reprocesar cobertura pendiente</button> : null}
    {version?.extractionCoverage?.length ? <fieldset className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3"><legend className="px-1 text-xs font-medium text-[var(--app-text-strong)]">Cobertura y reprocesamiento</legend><div className="mt-2 flex flex-wrap gap-2">{version.extractionCoverage.map((entry) => { const label = typeof entry.page === "number" ? `página ${entry.page}` : `hoja ${entry.worksheet ?? ""}`; const target = `${entry.page ?? entry.worksheet ?? ""}`; return <button key={target} type="button" disabled={reprocessing === `${document.id}:${target}`} onClick={() => onReprocess(typeof entry.page === "number" ? { pages: [entry.page] } : { worksheets: [entry.worksheet ?? ""] })} aria-label={`Reprocesar ${label} de ${document.name}`} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 disabled:opacity-60">Reprocesar {label}</button>; })}</div></fieldset> : null}
  </div>;
}
