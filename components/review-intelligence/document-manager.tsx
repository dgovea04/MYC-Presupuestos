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

export function DocumentManager({ projectId, documents, selectedDocumentIds = [], onSelectionChange, onChanged }: { projectId: string; documents: ReviewDocumentView[]; selectedDocumentIds?: string[]; onSelectionChange?: (ids: string[]) => void; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadKey = useRef<string | null>(null);
  const targetDocumentId = useRef<string | null>(null);
  const [category, setCategory] = useState<(typeof categories)[number]>("OTHER");
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true); setError(null);
    const formData = new FormData();
    formData.set("file", file); formData.set("category", category); formData.set("name", file.name); if (targetDocumentId.current) formData.set("documentId", targetDocumentId.current);
    try {
      const key = uploadKey.current ?? (uploadKey.current = `review-upload-${crypto.randomUUID()}`);
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-documents`, { method: "POST", headers: { "Idempotency-Key": key }, body: formData });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "No se pudo cargar el documento.");
      onChanged();
      uploadKey.current = null; targetDocumentId.current = null;
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No se pudo cargar el documento."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function clearDocuments() {
    const confirmation = "ELIMINAR DOCUMENTOS FUENTE";
    setClearDialogOpen(false);
    setClearing(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-documents`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "No se pudieron eliminar los documentos fuente.");
      onSelectionChange?.([]); onChanged();
    } catch (clearError) { setError(clearError instanceof Error ? clearError.message : "No se pudieron eliminar los documentos fuente."); }
    finally { setClearing(false); }
  }

  function toggleDocument(id: string) {
    const next = selectedDocumentIds.includes(id) ? selectedDocumentIds.filter((value) => value !== id) : [...selectedDocumentIds, id];
    onSelectionChange?.(next);
  }

  return (
    <Card id="review-document-manager" className="theme-surface-card" data-testid="review-document-manager">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>Documentos fuente</CardTitle><p className="mt-1 text-sm text-[var(--app-text-muted)]">PDF/XLSX versionados, sin ejecutar macros, scripts ni enlaces embebidos.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="review-document-category" className="sr-only">Categoría del documento</label>
          <Select id="review-document-category" aria-label="Categoría del documento" value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}>
            {categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </Select>
          <input ref={inputRef} type="file" accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Archivo PDF o XLSX" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          <Button type="button" onClick={() => inputRef.current?.click()} loading={uploading} aria-label="Cargar documento PDF o XLSX"><Upload className="h-4 w-4" aria-hidden="true" />Cargar documento</Button>
          <Button type="button" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setClearDialogOpen(true)} loading={clearing} disabled={documents.length === 0} aria-label="Eliminar documentos fuente"><Trash2 className="h-4 w-4" aria-hidden="true" />Limpiar fuentes</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
        {documents.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">Todavía no hay documentos asociados a este proyecto.</p> : null}
        {documents.map((document) => <DocumentRow key={document.id} document={document} selected={selectedDocumentIds.includes(document.id)} onToggle={() => toggleDocument(document.id)} onClassified={onChanged} onReplace={() => { targetDocumentId.current = document.id; inputRef.current?.click(); }} />)}
      </CardContent>
      <AlertDialog open={clearDialogOpen} title="Limpiar documentos fuente" description="Esta acción eliminará todos los documentos fuente, sus versiones, evidencias y revisiones del proyecto. El presupuesto y sus APU se conservarán." confirmLabel="Sí, limpiar fuentes" onConfirm={() => void clearDocuments()} onCancel={() => setClearDialogOpen(false)} />
    </Card>
  );
}

function DocumentRow({ document, selected, onToggle, onClassified, onReplace }: { document: ReviewDocumentView; selected: boolean; onToggle: () => void; onClassified: () => void; onReplace: () => void }) {
  const version = document.currentVersion;
  const isPdf = version?.mimeType.includes("pdf") || document.originalFileName.toLowerCase().endsWith(".pdf");
  const detail = version ? `${isPdf ? "PDF" : "XLSX"} · versión ${version.versionNumber} · ${isPdf ? `${version.pageCount ?? "—"} páginas` : `${version.sheetCount ?? "—"} hojas`}` : "Sin versión procesable";
  return <div className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Incluir ${document.name} en la revisión`} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" /><span className="rounded-lg bg-[var(--app-surface-muted)] p-2 text-[var(--app-primary-soft)]">{isPdf ? <FileText className="h-5 w-5" aria-hidden="true" /> : <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}</span><div className="min-w-0"><p className="truncate font-medium text-[var(--app-text-strong)]">{document.name}</p><p className="text-xs text-[var(--app-text-muted)]">{detail}</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">{categoryLabels[document.category as (typeof categories)[number]] ?? document.category} · Estado: {document.status}</p></div></div>
    <div className="flex items-start gap-2"><label className="sr-only" htmlFor={`classification-${document.id}`}>Clasificación de {document.name}</label><select id={`classification-${document.id}`} aria-label={`Clasificar ${document.name}`} defaultValue={document.category} onChange={(event) => { void fetch(`/api/review-documents/${encodeURIComponent(document.id)}/classification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: event.target.value }) }).then((response) => { if (!response.ok) throw new Error("classification"); onClassified(); }).catch(() => undefined); }} className="h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs"><option value="PLAN">Planos</option><option value="TECHNICAL_SPECIFICATION">Especificación técnica</option><option value="QUANTITY_TAKEOFF">Metrados</option><option value="BUDGET">Presupuesto</option><option value="APU">APU</option><option value="OTHER">Otro</option></select><button type="button" onClick={onReplace} className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs">Reemplazar versión</button></div>{document.warnings.length > 0 ? <div className="flex max-w-md items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><ul className="list-disc pl-3">{document.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
  </div>;
}
