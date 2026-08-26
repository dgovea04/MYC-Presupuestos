import { ArrowRight, Check } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { acquisitionFeatures, workflowCards } from "@/components/landing/acquisition/acquisition-landing-content";

export function ExcelWorkflowSection() {
  return (
    <section id="flujo" className="scroll-mt-24 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading badge="El cambio de flujo" title="De archivos dispersos a una base que tu equipo puede revisar." description="Excel sigue siendo parte del trabajo. La diferencia es dejar de usarlo como el lugar donde se pierde el contexto." />
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workflowCards.map((item, index) => { const Icon = item.icon; return <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-blue-600">0{index + 1}</span><Icon className="h-5 w-5 text-slate-500" /></div><h3 className="mt-8 font-semibold text-slate-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></article>; })}
        </div>
        <div id="funcionalidades" className="mt-20 scroll-mt-24"><SectionHeading badge="Funcionalidades principales" title="Un flujo técnico simple, desde la primera partida hasta la entrega." description="Empieza con las herramientas que necesitas hoy y conserva una base ordenada para crecer más adelante." /><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{acquisitionFeatures.map((item) => { const Icon = item.icon; return <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-semibold text-slate-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></article>; })}</div></div>
        <div className="mt-10 grid gap-6 rounded-[2rem] border border-blue-100 bg-blue-50/60 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8"><div><p className="text-sm font-semibold text-blue-700">Un primer paso concreto</p><p className="mt-2 max-w-2xl text-xl font-semibold tracking-tight text-slate-950">Crea tu cuenta gratis y comprueba el flujo con tu próximo presupuesto.</p></div><div className="flex flex-wrap gap-3 text-sm text-slate-700"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Sin tarjeta</span><ArrowRight className="hidden h-4 w-4 text-blue-600 sm:block" /><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Empieza en minutos</span></div></div>
      </div>
    </section>
  );
}
