"use client";

import { ChevronRight, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionPagination } from "@/components/ui/section-pagination";
import { Select } from "@/components/ui/select";
import type { FindingFilterState, PaginatedFindings } from "./types";
import { confidenceLabels, findingStatusLabels, reviewLabel } from "./labels";

const typeLabels: Record<string, string> = { QUANTITY_MISMATCH: "Diferencia de metrado", UNIT_INCONSISTENCY: "Unidad potencialmente inconsistente", TECHNICAL_SPEC_MISMATCH: "Nombre o especificación técnica", MISSING_DOCUMENTATION: "Cobertura insuficiente", INCOMPLETE_APU: "APU potencialmente incompleto" };
const statusOptions: Array<[string, string]> = Object.entries(findingStatusLabels);
const confidenceOptions: Array<[string, string]> = Object.entries(confidenceLabels);
const priorityOptions: Array<[string, string]> = [["0.75", "Alta"], ["0.5", "Media"], ["0.25", "Baja"]];

export function FindingQueue({ data, filters, onFilterChange, onOpenFinding }: { data: PaginatedFindings; filters?: FindingFilterState; onFilterChange: (filters: FindingFilterState) => void; onOpenFinding: (findingId: string) => void }) {
  const current = filters ?? { page: data.page, pageSize: data.pageSize };
  const update = (key: keyof FindingFilterState, value: string) => onFilterChange({ ...current, page: 1, [key]: value || undefined });
  const totalPages = data.page + (data.hasNextPage ? 1 : 0);

  return <Card className="theme-surface-card" data-testid="finding-queue">
    <CardHeader className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle className="text-base sm:text-lg">Bandeja de hallazgos</CardTitle><p className="mt-1 text-xs text-[var(--app-text-muted)]">Ordenados por prioridad e impacto potencial.</p></div>
        <span className="shrink-0 text-xs font-medium text-[var(--app-text-muted)]">{data.findings.length} visibles</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Filter label="Tipo" aria="Filtrar por tipo" value={current.findingType} onChange={(value) => update("findingType", value)} options={Object.entries(typeLabels)} />
        <Filter label="Estado" aria="Filtrar por estado" value={current.status} onChange={(value) => update("status", value)} options={statusOptions} />
        <Filter label="Confianza" aria="Filtrar por confianza" value={current.confidence} onChange={(value) => update("confidence", value)} options={confidenceOptions} />
        <Filter label="Prioridad mínima" aria="Filtrar por prioridad" value={current.priority?.toString()} onChange={(value) => update("priority", value)} options={priorityOptions} />
        <TextFilter label="Disciplina" aria="Filtrar por disciplina" value={current.discipline} onChange={(value) => update("discipline", value)} />
        <TextFilter label="Subpresupuesto" aria="Filtrar por subpresupuesto" value={current.subbudget} onChange={(value) => update("subbudget", value)} />
        <TextFilter label="Documento" aria="Filtrar por documento" value={current.document} onChange={(value) => update("document", value)} />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {data.findings.length === 0 ? <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--app-text-muted)]"><Inbox aria-hidden="true" /><p>No hay hallazgos con estos filtros</p></div> : <div className="overflow-x-auto rounded-xl border border-[var(--app-border-soft)]"><table className="w-full min-w-[900px] text-left text-xs"><caption className="sr-only">Hallazgos de la revisión</caption><thead className="bg-[var(--app-surface-muted)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--app-text-muted)]"><tr>{["Partida", "Prioridad", "Fuente", "Estado", "Tipo", "Severidad", "Confianza", "Impacto", ""].map((heading, index) => <th key={`${heading}-${index}`} className="whitespace-nowrap px-3 py-2.5 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[var(--app-border-soft)]">{data.findings.map((finding) => <tr key={finding.id} className="transition-colors hover:bg-[var(--app-surface-muted)]"><td className="px-3 py-3"><button type="button" onClick={() => onOpenFinding(finding.id)} aria-label={`Abrir hallazgo ${finding.budgetItem?.code ?? finding.id}`} className="font-semibold text-sky-700 hover:text-sky-900 hover:underline">{finding.budgetItem?.code ?? "Sin código"}</button></td><td className="px-3 py-3 tabular-nums">{finding.priority ?? "—"}</td><td className="max-w-48 truncate px-3 py-3" title={finding.evidence?.sourceName ?? finding.evidence?.documentVersionId ?? undefined}>{finding.evidence?.sourceName ?? finding.evidence?.documentVersionId ?? "—"}</td><td className="whitespace-nowrap px-3 py-3">{reviewLabel(findingStatusLabels, finding.status)}</td><td className="px-3 py-3">{typeLabels[finding.findingType] ?? finding.findingType}</td><td className="whitespace-nowrap px-3 py-3">{reviewLabel({ HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" }, finding.severity)}</td><td className="whitespace-nowrap px-3 py-3">{reviewLabel(confidenceLabels, finding.confidence)}</td><td className="whitespace-nowrap px-3 py-3 tabular-nums">{finding.potentialImpact ? `S/ ${finding.potentialImpact}` : "—"}</td><td className="px-3 py-3"><button type="button" onClick={() => onOpenFinding(finding.id)} aria-label={`Ver detalle de ${finding.budgetItem?.code ?? finding.id}`} className="inline-flex rounded-lg p-1 text-[var(--app-text-muted)] hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>}
      <SectionPagination currentPage={data.page} totalPages={totalPages} onPrevious={() => onFilterChange({ ...current, page: data.page - 1 })} onNext={() => onFilterChange({ ...current, page: data.page + 1 })} />
    </CardContent>
  </Card>;
}

function Filter({ label, aria, value, onChange, options }: { label: string; aria: string; value?: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block min-w-0 text-xs font-medium text-[var(--app-text-muted)]"><span className="mb-1.5 block">{label}</span><Select aria-label={aria} value={value ?? ""} className="h-9 rounded-lg px-2 text-xs" onChange={(event) => onChange(event.target.value)}><option value="">Todos</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</Select></label>;
}

function TextFilter({ label, aria, value, onChange }: { label: string; aria: string; value?: string; onChange: (value: string) => void }) {
  return <label className="block min-w-0 text-xs font-medium text-[var(--app-text-muted)]"><span className="mb-1.5 block">{label}</span><input aria-label={aria} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-2.5 text-xs font-normal text-[var(--app-text)] outline-none transition focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20" /></label>;
}
