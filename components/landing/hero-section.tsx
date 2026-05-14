import { ArrowRight, BarChart3, Calculator, FolderKanban, LayoutGrid, Sigma } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LandingLinkButton } from "@/components/landing/landing-link-button";

const summaryCards = [
  { label: "Costo directo", value: "S/ 982,420", tone: "text-slate-900" },
  { label: "GG + Utilidad", value: "S/ 142,860", tone: "text-slate-900" },
  { label: "Total de obra", value: "S/ 1,327,163", tone: "text-blue-700" },
];

const budgetRows = [
  { code: "01.01", item: "Movimiento de tierras", unit: "m3", qty: "180.00", partial: "S/ 94,200" },
  { code: "01.02", item: "Concreto armado", unit: "m3", qty: "245.50", partial: "S/ 381,050" },
  { code: "01.03", item: "Acero fy 4200", unit: "kg", qty: "18,920", partial: "S/ 267,772" },
  { code: "01.04", item: "Albanileria", unit: "m2", qty: "1,024.20", partial: "S/ 156,540" },
];

const sidebarItems = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Presupuestos", icon: FolderKanban, active: true },
  { label: "APU", icon: Calculator },
  { label: "Formula", icon: Sigma },
  { label: "Reportes", icon: BarChart3 },
];

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[60rem] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_72%)]" />
      <div className="relative mx-auto grid w-full max-w-[1600px] gap-14 px-5 pb-16 pt-28 sm:px-8 md:gap-16 md:pb-24 md:pt-32 lg:grid-cols-[0.96fr_1.04fr] lg:px-12 xl:grid-cols-[0.92fr_1.08fr] xl:px-16 2xl:px-20">
        <div className="flex flex-col justify-center">
          <Badge className="w-fit border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-blue-700 uppercase">
            Plataforma moderna de costos y presupuestos de obra
          </Badge>
          <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
            Presupuestos de obra mas claros, conectados y listos para decidir.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            MYC Presupuestos unifica presupuestos, APU, catalogo de insumos, formula polinomica, programacion y reportes en una experiencia SaaS hecha para ingenieria civil y oficinas tecnicas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LandingLinkButton href="/register" className="gap-2">
              Empezar con MYC
              <ArrowRight className="h-4 w-4" />
            </LandingLinkButton>
            <LandingLinkButton href="/login" variant="secondary">
              Ver plataforma
            </LandingLinkButton>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="landing-chip rounded-full px-3 py-1.5">Presupuestos generales</span>
            <span className="landing-chip rounded-full px-3 py-1.5">APU detallado</span>
            <span className="landing-chip rounded-full px-3 py-1.5">Normativa peruana</span>
          </div>
        </div>

        <Card className="landing-surface-elevated overflow-hidden rounded-[1.9rem] p-3 backdrop-blur lg:ml-4 xl:ml-6">
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-[1.25rem] border border-slate-200 bg-slate-950 p-4 text-slate-200">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-semibold tracking-[0.18em] text-sky-200 uppercase">Obra activa</p>
                <p className="mt-2 text-lg font-semibold text-white">Edificio Miraflores 12</p>
                <p className="mt-1 text-sm text-slate-400">Presupuesto general v4</p>
              </div>
              <div className="mt-4 space-y-2">
                {sidebarItems.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                      item.active ? "bg-white text-slate-950" : "text-slate-300"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Indice de avance</p>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-[68%] rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#2563eb_100%)]" />
                </div>
                <p className="mt-3 text-sm text-white">68% del presupuesto estructurado</p>
              </div>
            </aside>

            <div className="rounded-[1.25rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <div className="grid gap-3 md:grid-cols-3">
                {summaryCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/80">
                    <p className="text-xs font-medium text-slate-500">{card.label}</p>
                    <p className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/80">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Presupuesto general</p>
                      <p className="text-xs text-slate-500">Vista compacta inspirada en hoja de costos</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Actualizado</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Codigo</th>
                          <th className="px-3 py-2 text-left font-medium">Partida</th>
                          <th className="px-3 py-2 text-left font-medium">Und.</th>
                          <th className="px-3 py-2 text-right font-medium">Metrado</th>
                          <th className="px-3 py-2 text-right font-medium">Parcial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetRows.map((row) => (
                          <tr key={row.code} className="border-t border-slate-100">
                            <td className="px-3 py-3 text-slate-500">{row.code}</td>
                            <td className="px-3 py-3 font-medium text-slate-900">{row.item}</td>
                            <td className="px-3 py-3 text-slate-500">{row.unit}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{row.qty}</td>
                            <td className="px-3 py-3 text-right font-medium text-slate-900">{row.partial}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Incidencia por especialidad</p>
                        <p className="text-xs text-slate-500">Placeholder de grafico con CSS</p>
                      </div>
                      <span className="text-xs text-slate-400">Q2</span>
                    </div>
                    <div className="mt-5 flex h-36 items-end justify-between gap-3">
                      {[52, 88, 74, 103, 66].map((height, index) => (
                        <div key={height} className="flex flex-1 flex-col items-center gap-2">
                          <div
                            className={`w-full rounded-t-2xl ${
                              index === 3 ? "bg-[linear-gradient(180deg,#2563eb_0%,#1d4ed8_100%)]" : "bg-slate-200"
                            }`}
                            style={{ height }}
                          />
                          <span className="text-[11px] text-slate-400">S{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm shadow-slate-200/70">
                    <p className="text-sm font-semibold">Formula polinomica lista para reajuste</p>
                    <div className="mt-4 flex items-end gap-2">
                      {[22, 38, 31, 46, 58, 42, 64].map((height) => (
                        <div key={height} className="flex h-16 flex-1 items-end rounded-full bg-white/10 p-1">
                          <div className="w-full rounded-full bg-sky-400" style={{ height }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-white/5 px-2 py-3">
                        <p className="text-slate-400">MO</p>
                        <p className="mt-1 font-semibold text-white">0.314</p>
                      </div>
                      <div className="rounded-xl bg-white/5 px-2 py-3">
                        <p className="text-slate-400">MAT</p>
                        <p className="mt-1 font-semibold text-white">0.426</p>
                      </div>
                      <div className="rounded-xl bg-white/5 px-2 py-3">
                        <p className="text-slate-400">EQ</p>
                        <p className="mt-1 font-semibold text-white">0.260</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
