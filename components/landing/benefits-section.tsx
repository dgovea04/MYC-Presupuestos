import { benefitItems } from "@/components/landing/landing-content";
import { SectionHeading } from "@/components/landing/section-heading";

export function BenefitsSection() {
  return (
    <section className="landing-section-contrast bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Beneficios"
          title="Productividad, trazabilidad y entregables para oficina técnica."
          description="La plataforma conecta automatización revisable, notas contextuales y reportes para avanzar sin perder control técnico."
          tone="dark"
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {benefitItems.map((benefit) => (
            <div
              key={benefit.title}
              className="landing-surface-contrast rounded-[1.75rem] border border-white/10 p-7 backdrop-blur"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-300">
                <benefit.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
