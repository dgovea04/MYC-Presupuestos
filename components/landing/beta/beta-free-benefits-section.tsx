import { BrainCircuit, Calculator, FileSpreadsheet, Layers3, MessageCircle } from "lucide-react";

const benefits = [
  { title: "Presupuesto conectado", text: "Organiza partidas, cantidades y costos en una base que tu equipo puede revisar.", icon: FileSpreadsheet },
  { title: "APU desde la partida", text: "Consulta recursos, rendimientos y costo unitario sin perder el contexto técnico.", icon: Calculator },
  { title: "Metrados y fórmula", text: "Prueba herramientas avanzadas para llevar cantidades y reajustes dentro del mismo flujo.", icon: Layers3 },
  { title: "Acompañamiento real", text: "Comparte feedback y recibe orientación para comenzar con un presupuesto de trabajo.", icon: MessageCircle },
] as const;

export function BetaFreeBenefitsSection() {
  return (
    <section id="beneficios" className="scroll-mt-24 bg-slate-950 py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Qué vas a probar</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Una prueba gratuita que empieza con trabajo real.</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">No buscamos que mires otra herramienta. Queremos que pruebes si una base técnica conectada mejora la forma en que preparas y revisas tus presupuestos.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map(({ title, text, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <span className="inline-flex rounded-xl bg-blue-500/15 p-2.5 text-sky-300"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-5 font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-sm leading-6 text-slate-300"><BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />Khipu puede ayudarte a revisar inconsistencias, pero el criterio técnico y las decisiones siguen siendo tuyos.</div>
      </div>
    </section>
  );
}
