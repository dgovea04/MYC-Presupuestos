"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Download, FileArchive, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadBlob, requestExportBlob } from "@/lib/exports/download";
import type { ProjectPackageExportFormat, ProjectPackageExportSection } from "@/lib/exports/definitions";

const sections: Array<{ id: ProjectPackageExportSection; label: string }> = [
  { id: "executive_summary", label: "Resumen ejecutivo" },
  { id: "sub_budgets", label: "Todos los subpresupuestos" },
  { id: "resources", label: "Lista de insumos" },
  { id: "general_expenses", label: "Gastos generales" },
  { id: "budget_footer", label: "Pie de presupuesto" },
  { id: "polynomial_formula", label: "Fórmula polinómica" },
];

const formats: Array<{ id: ProjectPackageExportFormat; label: string }> = [
  { id: "xlsx", label: "Excel" },
  { id: "pdf", label: "PDF" },
  { id: "csv", label: "CSV" },
];

const allSections = sections.map((item) => item.id);
const allFormats = formats.map((item) => item.id);

export function ProjectPackageExportPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<ProjectPackageExportSection[]>(allSections);
  const [selectedFormats, setSelectedFormats] = useState<ProjectPackageExportFormat[]>(allFormats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const summary = `${selectedSections.length} secciones · ${selectedFormats.length} formatos · ${selectedSections.length * selectedFormats.length} archivos estimados`;

  function toggleSection(section: ProjectPackageExportSection) {
    setSelectedSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  }

  function toggleFormat(format: ProjectPackageExportFormat) {
    setSelectedFormats((current) => current.includes(format) ? current.filter((item) => item !== format) : [...current, format]);
  }

  async function exportPackage() {
    if (selectedSections.length === 0 || selectedFormats.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const result = await requestExportBlob({ target: "project_package", targetId: projectId, format: "zip", preset: "proyecto_completo_zip", options: { packageSections: selectedSections, packageFormats: selectedFormats } });
      downloadBlob(result.fileName, result.blob);
      setOpen(false);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "No se pudo generar el paquete ZIP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" className="gap-2"><FileArchive className="h-4 w-4" />Exportar paquete ZIP</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[259] bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="theme-surface-card fixed right-0 top-0 z-[260] flex h-dvh w-full max-w-md flex-col border-l shadow-2xl focus:outline-none">
          <div className="border-[var(--app-border)] flex items-start justify-between border-b px-6 py-5">
            <div><Dialog.Title className="theme-strong-text text-lg font-semibold">Preparar exportacion</Dialog.Title><Dialog.Description className="theme-muted-text mt-1 text-sm">Configura qué secciones y formatos deseas incluir.</Dialog.Description></div>
            <Dialog.Close asChild><button type="button" aria-label="Cerrar" className="theme-muted-text hover:theme-muted-panel hover:theme-strong-text rounded-xl border border-transparent p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"><X className="h-4 w-4" /><span className="sr-only">Cerrar</span></button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <section className="space-y-2"><div className="theme-muted-text text-xs font-semibold uppercase tracking-wide">Preset</div><div className="theme-quick-action-primary rounded-2xl border px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="theme-strong-text font-medium">Paquete documental ZIP</span><FileArchive className="h-4 w-4 text-violet-700 dark:text-violet-300" /></div><span className="theme-muted-text mt-1 block text-xs leading-5">Resumen, subpresupuestos y secciones técnicas seleccionadas.</span></div></section>
              <section className="space-y-2"><p className="theme-muted-text text-xs font-semibold uppercase tracking-wide">Formato</p><div className="grid grid-cols-2 gap-2">{formats.map((format) => <CheckOption key={format.id} checked={selectedFormats.includes(format.id)} label={format.label} onChange={() => toggleFormat(format.id)} compact />)}</div></section>
              <section className="theme-muted-panel space-y-3 rounded-2xl border p-4"><p className="theme-muted-text text-xs font-semibold uppercase tracking-wide">Opciones</p>{sections.map((section) => <CheckOption key={section.id} checked={selectedSections.includes(section.id)} label={section.label} onChange={() => toggleSection(section.id)} />)}</section>
              <section className="theme-surface-card rounded-2xl border p-4"><p className="theme-muted-text text-xs font-semibold uppercase tracking-wide">Resumen</p><p className="theme-strong-text mt-2 text-sm font-medium">{summary}</p><p className="theme-muted-text mt-3 text-xs leading-5">Se generará un archivo por cada sección y formato seleccionado dentro de un único paquete ZIP.</p></section>
              {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm">{error}</p> : null}
            </div>
          </div>
          <div className="border-[var(--app-border)] border-t px-6 py-4"><Button type="button" className="w-full gap-2" disabled={loading || selectedSections.length === 0 || selectedFormats.length === 0} onClick={() => void exportPackage()}>{loading ? "Generando..." : <><Download className="h-4 w-4" />Generar ZIP</>}</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CheckOption({ checked, label, onChange, compact = false }: { checked: boolean; label: string; onChange: () => void; compact?: boolean }) {
  return <label className={`theme-strong-text flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${compact ? "border-[var(--app-border)] bg-[var(--app-surface)]" : "border-transparent"}`}><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded" /><span>{label}</span>{checked ? <Check className="ml-auto h-4 w-4 text-violet-700 dark:text-violet-300" /> : null}</label>;
}
