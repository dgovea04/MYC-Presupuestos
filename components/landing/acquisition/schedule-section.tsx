import { CalendarRange, ChartNoAxesCombined, ListChecks } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";

const scheduleSteps = [
  { title: "Ordena partidas", description: "Parte de la estructura de tu presupuesto.", icon: ListChecks },
  { title: "Programa actividades", description: "Distribuye el trabajo en el tiempo.", icon: CalendarRange },
  { title: "Revisa el avance", description: "Conecta cantidades, recursos y valorización.", icon: ChartNoAxesCombined },
] as const;

export function ScheduleSection() {
  return <section id="cronograma" className="scroll-mt-24 bg-slate-50 py-20 md:py-28"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeading badge="Cronograma" title="Organiza tu obra de principio a fin." description="Cuando el presupuesto está ordenado, puedes convertir sus partidas en una programación clara y revisar cómo avanza el trabajo." /><div className="mt-10 grid gap-4 md:grid-cols-3">{scheduleSteps.map(({ title, description, icon: Icon }, index) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-blue-600">0{index + 1}</span><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon className="h-5 w-5" /></span></div><h3 className="mt-7 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div></div></section>;
}
