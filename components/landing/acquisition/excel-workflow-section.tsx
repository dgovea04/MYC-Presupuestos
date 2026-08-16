import { ArrowRight, Check } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { workflowCards } from "@/components/landing/acquisition/acquisition-landing-content";

export function ExcelWorkflowSection() {
  return (
    <section id="flujo" className="scroll-mt-24 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading badge="El cambio de flujo" title="De archivos dispersos a una base que tu equipo puede revisar." description="Excel sigue siendo parte del trabajo. La diferencia es dejar de usarlo como el lugar donde se pierde el contexto." />
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workflowCards.map((item, index) => { const Icon = item.icon; return <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-blue-600">0{index + 1}</span><Icon className="h-5 w-5 text-slate-500" /></div><h3 className="mt-8 font-semibold text-slate-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></article>; })}
        </div>
        <div className="mt-10 grid gap-6 rounded-[2rem] border border-blue-100 bg-blue-50/60 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8"><div><p className="text-sm font-semibold text-blue-700">Un primer paso concreto</p><p className="mt-2 max-w-2xl text-xl font-semibold tracking-tight text-slate-950">Crea un presupuesto demo o importa tu archivo para comprobar el flujo con datos reales.</p></div><div className="flex flex-wrap gap-3 text-sm text-slate-700"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Sin reconstruir desde cero</span><ArrowRight className="hidden h-4 w-4 text-blue-600 sm:block" /><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Trazabilidad desde la partida</span></div></div>
      </div>
    </section>
  );
}
