import { AlertTriangle, CheckCircle2, Download, Search, StickyNote, TableProperties, WandSparkles } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";

const previewRows = [
  { code: "02.01.01", description: "Trazo, niveles y replanteo", unit: "m2", quantity: "2,850.00", unitPrice: "12.80", total: "S/ 36,480.00" },
  { code: "02.01.02", description: "Excavación manual para zapatas", unit: "m3", quantity: "412.60", unitPrice: "48.20", total: "S/ 19,887.32" },
  { code: "02.01.03", description: "Concreto f'c=210 kg/cm2", unit: "m3", quantity: "186.20", unitPrice: "421.75", total: "S/ 78,524.85" },
  { code: "02.01.04", description: "Acero corrugado fy=4200", unit: "kg", quantity: "15,640.00", unitPrice: "5.82", total: "S/ 91,024.80" },
];

const actionItems = [
  { title: "Pegado avanzado", detail: "Datos normalizados desde Excel", icon: TableProperties },
  { title: "Sugerencias", detail: "Insumos y partidas similares", icon: WandSparkles },
  { title: "Exportación lista", detail: "PDF, Excel, CSV o ZIP", icon: Download },
];

const notes = [
  { title: "Revisar unidad de partida", detail: "Concreto f'c=210 aparece en m3 y m2", tone: "amber" },
  { title: "APU sugerido pendiente", detail: "3 insumos con confianza alta", tone: "blue" },
  { title: "Cronograma generado", detail: "12 partidas listas para valorización", tone: "emerald" },
];

export function ProductPreviewSection() {
  return (
    <section id="preview" className="landing-section scroll-mt-28 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <div className="landing-shell">
        <SectionHeading
          badge="Vista de producto"
          title="Una superficie moderna para trabajar como en obra."
          description="Modo moderno para lectura clara, modo Excel para operación compacta, sugerencias revisables y exportes listos sin salir del flujo."
        />
        <div className="mt-14 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="landing-surface-elevated overflow-hidden rounded-[1.9rem]">
            <div className="border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-[1.32rem] font-semibold tracking-tight text-slate-950">
                    Presupuesto de estructuras
                  </p>
                  <p className="mt-2 max-w-2xl text-[0.98rem] leading-7 text-slate-500">
                    Tabla editable con búsqueda, sugerencias, pegado de datos y lectura compacta para revisión técnica.
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
                  <span className="inline-flex rounded-full bg-slate-950 px-3 py-1.5 text-white">Modo moderno</span>
                  <span className="inline-flex px-3 py-1.5 text-slate-500">Modo Excel</span>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {actionItems.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <item.icon className="h-4 w-4 text-blue-600" />
                      {item.title}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Search className="h-4 w-4 text-blue-600" />
                  Buscar por partida, insumo, unidad o código
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">4 sugerencias activas</span>
              </div>
              <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Item</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Descripción</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Und.</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">Metrado</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">P.U.</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">Parcial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={row.code} className={index === 2 ? "bg-blue-50/50" : "bg-white"}>
                          <td className="border-b border-slate-100 px-4 py-3 text-slate-500">{row.code}</td>
                          <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">{row.description}</td>
                          <td className="border-b border-slate-100 px-4 py-3 text-slate-500">{row.unit}</td>
                          <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-600">{row.quantity}</td>
                          <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-600">{row.unitPrice}</td>
                          <td className="border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-950">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[1.9rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Notas y acciones</p>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  Contextual
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {notes.map((note) => (
                  <div key={note.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-start gap-3">
                      {note.tone === "amber" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                      ) : note.tone === "emerald" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      ) : (
                        <StickyNote className="mt-0.5 h-4 w-4 text-blue-600" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{note.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.9rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_20px_60px_-45px_rgba(15,23,42,0.55)]">
              <p className="text-sm font-semibold">Paquete exportable</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Presupuesto, APU, cronograma, calendario valorizado y Curva S preparados con presets configurables.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-200">
                {["PDF", "Excel", "CSV", "ZIP"].map((format) => (
                  <span key={format} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                    {format}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
