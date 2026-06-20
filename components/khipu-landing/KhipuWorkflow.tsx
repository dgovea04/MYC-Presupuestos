import { SectionHeading } from "@/components/landing/section-heading";
import { Brain, Network, Sparkles } from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: Network,
    title: "Conecta el contexto",
    description:
      "Khipu entiende el módulo activo: presupuesto, APU, metrados, catálogos o reportes.",
  },
  {
    number: 2,
    icon: Brain,
    title: "Analiza la información",
    description:
      "Revisa estructuras, cantidades, unidades, costos, insumos y posibles inconsistencias.",
  },
  {
    number: 3,
    icon: Sparkles,
    title: "Entrega recomendaciones",
    description:
      "Devuelve respuestas claras, accionables y preparadas para revisión humana.",
  },
];

export function KhipuWorkflow() {
  return (
    <section id="como-funciona" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Cómo funciona"
        title="Cómo trabaja Khipu."
        description="Tres pasos simples para obtener análisis técnico con contexto real de tu proyecto."
        align="center"
      />
      <div className="mt-14 grid gap-8 md:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;

          return (
            <div
              key={step.number}
              className="relative flex flex-col items-center text-center"
            >
              {/* Step connector line */}
              {step.number < STEPS.length ? (
                <div className="absolute left-1/2 top-11 hidden h-0.5 w-full bg-[linear-gradient(90deg,rgba(6,207,227,0.6),rgba(226,232,240,0.4))] md:block" />
              ) : null}

              {/* Step number + icon */}
              <div className="relative z-10 flex h-22 w-22 items-center justify-center rounded-[1.75rem] border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#f0f9ff_100%)] shadow-lg shadow-cyan-100/40">
                <Icon className="h-8 w-8 text-cyan-700" />
              </div>

              <span className="mt-4 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-cyan-700 uppercase">
                Paso {step.number}
              </span>

              <h3 className="mt-3 font-display text-xl font-semibold text-slate-950">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[28ch] text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
