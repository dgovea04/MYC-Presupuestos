import { SectionHeading } from "@/components/landing/section-heading";

const previewRows = [
  { code: "02.01.01", description: "Trazo, niveles y replanteo", unit: "m2", quantity: "2,850.00", unitPrice: "12.80", total: "S/ 36,480.00" },
  { code: "02.01.02", description: "Excavacion manual para zapatas", unit: "m3", quantity: "412.60", unitPrice: "48.20", total: "S/ 19,887.32" },
  { code: "02.01.03", description: "Concreto fc=210 kg/cm2", unit: "m3", quantity: "186.20", unitPrice: "421.75", total: "S/ 78,524.85" },
  { code: "02.01.04", description: "Acero corrugado fy=4200", unit: "kg", quantity: "15,640.00", unitPrice: "5.82", total: "S/ 91,024.80" },
  { code: "02.01.05", description: "Encofrado y desencofrado", unit: "m2", quantity: "1,264.30", unitPrice: "63.40", total: "S/ 80,155.62" },
];

const rightPanelItems = [
  { label: "Costo directo", value: "S/ 306,072.59" },
  { label: "Gastos generales", value: "S/ 30,607.26" },
  { label: "Utilidad", value: "S/ 24,485.81" },
  { label: "IGV", value: "S/ 64,991.43" },
];

const activityItems = [
  { title: "Revisi\u00F3n de metrados completada", detail: "Sector estructuras - hace 12 min" },
  { title: "Costo unitario recalculado", detail: "Partida 02.01.03 - hace 8 min" },
  { title: "Exportaci\u00F3n lista para obra", detail: "Resumen PDF y Excel - hace 3 min" },
];

export function ProductPreviewSection() {
  return (
    <section id="preview" className="landing-section scroll-mt-28 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <div className="landing-shell">
        <SectionHeading
          badge="Vista de producto"
          title="Una interfaz de presupuesto que conserva familiaridad, pero gana orden y contexto."
          description="La tabla central mantiene lectura compacta tipo Excel moderno, mientras los paneles laterales agregan resumen, incidencias y acciones sin saturar la pantalla."
        />
        <div className="mt-14 grid gap-6 xl:grid-cols-[1.42fr_0.78fr]">
          <div className="landing-surface-elevated overflow-hidden rounded-[1.9rem]">
            <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-[1.32rem] font-semibold tracking-tight text-slate-950">
                    Presupuesto de estructuras
                  </p>
                  <p className="mt-2 max-w-2xl text-[0.98rem] leading-7 text-slate-500">
                    Modo compacto para partidas, metrados y precios unitarios con lectura clara para revision tecnica.
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-600">Resumen</span>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">Vista Excel</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Obra activa</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">Edificio Miraflores 12 - Estructuras</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Version</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">Presupuesto general v4</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Estado</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">Listo para revision</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Item</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Descripcion</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Und.</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">Cantidad</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">P.U.</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">Parcial</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-slate-100/90">
                        <td className="border-b border-slate-200 px-4 py-3 text-slate-500">02.00.00</td>
                        <td className="border-b border-slate-200 px-4 py-3">
                          <p className="font-display text-base font-semibold tracking-tight text-slate-950">Estructuras</p>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-3" />
                        <td className="border-b border-slate-200 px-4 py-3" />
                        <td className="border-b border-slate-200 px-4 py-3" />
                        <td className="border-b border-slate-200 px-4 py-3" />
                      </tr>
                      <tr className="bg-slate-50/90">
                        <td className="border-b border-slate-200 px-4 py-2.5 text-slate-400">02.00.00</td>
                        <td className="border-b border-slate-200 px-4 py-2.5">
                          <p className="text-sm font-medium text-slate-600">Columnas</p>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-2.5" />
                        <td className="border-b border-slate-200 px-4 py-2.5" />
                        <td className="border-b border-slate-200 px-4 py-2.5" />
                        <td className="border-b border-slate-200 px-4 py-2.5" />
                      </tr>
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
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Partidas activas</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">126</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Costo directo</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">S/ 306,072.59</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Ultima revision</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">Hoy 18:40</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.9rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Resumen lateral</p>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Sin alertas
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {rightPanelItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="text-sm text-slate-500">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-950">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[1.35rem] bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] px-4 py-4 text-white shadow-lg shadow-blue-200/60">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Total presupuestado</p>
                <p className="mt-2 text-2xl font-semibold">S/ 426,157.09</p>
              </div>
              <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Actividad reciente</p>
                <div className="mt-4 space-y-3">
                  {activityItems.map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[1.9rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_20px_60px_-45px_rgba(15,23,42,0.55)]">
              <p className="text-sm font-semibold">Distribucion por frente</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: "Estructuras", width: "76%" },
                  { label: "Arquitectura", width: "58%" },
                  { label: "Instalaciones", width: "42%" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="text-white">{item.width}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#2563eb_100%)]" style={{ width: item.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
