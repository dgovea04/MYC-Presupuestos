import { Check } from "lucide-react";
import { TrackPricingView } from "@/components/analytics/track-pricing-view";
import { pricingPlans } from "@/components/landing/landing-content";
import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { SectionHeading } from "@/components/landing/section-heading";

const planMeta: Record<string, { audience: string; cadence: string; note: string; cta: string }> = {
  Starter: {
    audience: "Para independientes y equipos pequeños",
    cadence: "gratis con límites operativos",
    note: "Trabaja presupuestos y APU básicos sin quedar en modo demo.",
    cta: "Crear gratis",
  },
  Pro: {
    audience: "Para oficinas técnicas",
    cadence: "por equipo / mes",
    note: "Automatización, IA, cronograma y exportes avanzados para mayor volumen.",
    cta: "Elegir Pro",
  },
  Empresa: {
    audience: "Para constructoras y equipos multiárea",
    cadence: "Cotización personalizada",
    note: "Administración, límites altos, estándares internos y acompañamiento.",
    cta: "Solicitar acceso",
  },
};

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-28 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] py-20 md:py-28">
      <TrackPricingView />
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-12">
        <SectionHeading
          badge="Precios"
          title="Elige el plan según el nivel de control que necesita tu equipo."
          description="La estrategia Starter permite trabajar de verdad; Pro monetiza automatización y entregables avanzados; Empresa suma administración, soporte y control operativo."
          align="center"
        />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Starter útil</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Pro para automatización</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Empresa para estandarización</span>
        </div>
        <div className="mt-14 grid gap-6 xl:grid-cols-[0.96fr_1.08fr_0.96fr]">
          {pricingPlans.map((plan, index) => {
            const meta = planMeta[plan.name];

            return (
              <div
                key={plan.name}
                className={`relative overflow-hidden rounded-[1.9rem] border p-8 shadow-sm transition duration-300 ${
                  plan.highlight
                    ? "landing-surface-contrast border-blue-200 bg-slate-950 text-white xl:-translate-y-3"
                    : "landing-surface-elevated text-slate-950 hover:-translate-y-1 hover:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.3)]"
                }`}
              >
                <div
                  className={`absolute inset-x-0 top-0 h-24 ${
                    plan.highlight
                      ? "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_58%)]"
                      : "bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_58%)]"
                  }`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold ${
                          plan.highlight ? "bg-white/10 text-sky-300" : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        0{index + 1}
                      </span>
                      <p className={`font-display text-sm font-semibold uppercase tracking-[0.18em] ${plan.highlight ? "text-sky-300" : "text-blue-700"}`}>
                        {plan.name}
                      </p>
                    </div>
                    {plan.badge ? (
                      <span
                        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                          plan.highlight
                            ? "border-white/15 bg-white/10 text-sky-200"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {plan.badge}
                      </span>
                    ) : null}
                    <p className={`mt-4 text-sm ${plan.highlight ? "text-slate-300" : "text-slate-500"}`}>{meta.audience}</p>
                    {plan.originalPrice ? (
                      <p className={`mt-3 text-sm line-through ${plan.highlight ? "text-slate-500" : "text-slate-400"}`}>{plan.originalPrice}</p>
                    ) : null}
                    <p className="font-display mt-1 text-[2.7rem] font-semibold tracking-tight">{plan.price}</p>
                    <p className={`mt-2 text-sm ${plan.highlight ? "text-slate-400" : "text-slate-500"}`}>{meta.cadence}</p>
                  </div>
                  {plan.highlight ? (
                    <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-sky-200">
                      Recomendado
                    </span>
                  ) : null}
                </div>
                <div className={`relative mt-6 rounded-[1.35rem] border px-4 py-4 ${plan.highlight ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50/70"}`}>
                  <p className={`text-sm leading-7 ${plan.highlight ? "text-slate-200" : "text-slate-700"}`}>{plan.description}</p>
                  <p className={`mt-3 text-sm ${plan.highlight ? "text-slate-400" : "text-slate-500"}`}>{meta.note}</p>
                </div>
                <div className="relative mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${
                          plan.highlight ? "bg-white/10 text-sky-300" : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className={`text-sm leading-7 ${plan.highlight ? "text-slate-200" : "text-slate-700"}`}>{feature}</span>
                    </div>
                  ))}
                </div>
                <div className={`relative mt-8 h-px ${plan.highlight ? "bg-white/10" : "bg-slate-200"}`} />
                <LandingLinkButton
                  href="/register"
                  variant={plan.highlight ? "primary" : "secondary"}
                  className={`relative mt-8 w-full ${plan.highlight ? "shadow-none hover:shadow-none" : ""}`}
                >
                  {meta.cta}
                </LandingLinkButton>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
