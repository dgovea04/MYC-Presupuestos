import { ArrowRight } from "lucide-react";
import { smartFlowItems } from "@/components/landing/landing-content";
import { SectionHeading } from "@/components/landing/section-heading";

export function SmartFlowsSection() {
  return (
    <section id="flows" className="landing-section-tight landing-shell scroll-mt-28">
      <SectionHeading
        badge={"Flujo\u00a0conectado"}
        title="Del presupuesto al entregable sin cambiar de forma de trabajo."
        description="La operacion se mantiene conectada desde la carga inicial hasta la revision con Khipu y la salida final."
        align="center"
      />
      <div className="mt-12 grid gap-6 xl:grid-cols-4">
        {smartFlowItems.map((flow) => (
          <article
            key={flow.title}
            className="landing-surface-elevated rounded-[2rem] p-7"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <flow.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold tracking-tight text-slate-950">{flow.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{flow.description}</p>
            <div className="mt-6 space-y-3">
              {flow.steps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                    {index + 1}
                  </span>
                  <span className="font-medium">{step}</span>
                  {index < flow.steps.length - 1 ? <ArrowRight className="ml-auto h-4 w-4 text-slate-300" /> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
