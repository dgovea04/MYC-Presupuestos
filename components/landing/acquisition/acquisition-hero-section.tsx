import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { AcquisitionCta } from "@/components/landing/acquisition/acquisition-cta";
import { DEMO_VIDEO_URL } from "@/components/landing/acquisition/acquisition-landing-content";

export function AcquisitionHeroSection() {
  return (
    <section className="overflow-hidden bg-[radial-gradient(circle_at_15%_5%,rgba(37,99,235,0.14),transparent_32%),linear-gradient(180deg,#fff_0%,#f8fafc_100%)]">
      <div className="landing-shell grid gap-12 pb-20 pt-28 md:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28">
        <div>
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Presupuestos para construcción en Perú</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[4.2rem] lg:leading-[1.02]">Presupuestos de obra, sin depender de archivos dispersos.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Presupuesto + APU + Metrados + Fórmula polinómica en un flujo técnico conectado para preparar, revisar y entregar tu trabajo con más control.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AcquisitionCta href="/register" location="acquisition_hero" className="gap-2">Crear mi primer presupuesto gratis <ArrowRight className="h-4 w-4" /></AcquisitionCta>
            <AcquisitionCta href={DEMO_VIDEO_URL} target="_blank" rel="noreferrer" location="acquisition_hero_demo" variant="secondary" className="gap-2"><PlayCircle className="h-4 w-4" />Ver demo de 3 minutos</AcquisitionCta>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            {['Starter útil desde el primer día', 'Importa desde Excel', 'Sin cobro automático en la Beta'].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</span>)}
          </div>
        </div>
        <div className="relative rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.7)]">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900 p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="text-sm font-semibold text-white">Presupuesto · Residencial Andina</span><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">En revisión</span></div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-xs"><Metric label="Costo directo" value="S/ 842,560" /><Metric label="Partidas" value="128" /><Metric label="APU vinculados" value="96%" /></div>
            <div className="mt-5 space-y-3"><WorkflowRow label="01.01 Movimiento de tierras" value="S/ 124,800" tone="blue" /><WorkflowRow label="02.03 Concreto armado" value="S/ 318,420" tone="emerald" /><WorkflowRow label="03.01 Arquitectura" value="S/ 196,240" tone="amber" /></div>
            <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-400/10 p-3 text-xs text-blue-100"><span className="font-semibold text-blue-300">APU conectado:</span> rendimiento, unidad y costo unitario disponibles desde la partida.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>;
}

function WorkflowRow({ label, value, tone }: { label: string; value: string; tone: "blue" | "emerald" | "amber" }) {
  const colors = { blue: "bg-blue-400", emerald: "bg-emerald-400", amber: "bg-amber-400" };
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-slate-300"><span className={`h-2 w-2 shrink-0 rounded-full ${colors[tone]}`} />{label}</span><span className="shrink-0 font-medium text-white">{value}</span></div>;
}
