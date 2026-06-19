import { featureItems } from "@/components/landing/landing-content";
import { SectionHeading } from "@/components/landing/section-heading";
import { Card } from "@/components/ui/card";

export function FeaturesSection() {
  return (
    <section id="features" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Módulos clave"
        title="Todo lo que necesitas para preparar y controlar presupuestos de obra."
        description="Cada módulo combina operación diaria, automatización revisable y entregables listos para oficina técnica."
        align="center"
      />
      <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {featureItems.map((feature, index) => (
          <Card
            key={feature.title}
            className="landing-surface-elevated group relative overflow-hidden rounded-[2rem] p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_30px_80px_-42px_rgba(37,99,235,0.24)]"
          >
            <div className="absolute inset-x-0 top-0 h-24 rounded-t-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_62%)] opacity-70" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] text-blue-700 shadow-sm shadow-blue-100/70 transition group-hover:scale-[1.03]">
                <feature.icon className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase">
                0{index + 1}
              </span>
            </div>
            <div className="relative">
              <h3 className="mt-6 font-display text-[1.35rem] font-semibold tracking-tight text-slate-950">{feature.title}</h3>
              <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-7 text-slate-600">{feature.description}</p>
            </div>
            <div className="relative mt-6 h-px bg-[linear-gradient(90deg,rgba(37,99,235,0.18),rgba(226,232,240,0.6),transparent)]" />
            <div className="relative mt-5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-500">Módulo operativo</span>
              <span className="text-blue-700 transition group-hover:translate-x-0.5">Ver flujo</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
