import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { KhipuBadge } from "@/components/khipu/KhipuBadge";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const TRUST_SIGNALS = [
  "IA local revisable",
  "No modifica presupuestos sin intervención humana",
  "Siempre declara supuestos",
];

export function KhipuHero() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_22%_10%,rgba(6,207,227,0.1),transparent_32%),radial-gradient(circle_at_78%_16%,rgba(37,99,235,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_78%)]" />

      <div className="landing-shell relative flex w-full flex-col gap-10 pb-12 pt-24 md:pb-16 md:pt-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          {/* Badge */}
          <div className="flex items-center gap-3">
            <KhipuSymbol className="h-12 w-12" />
            <KhipuBadge />
          </div>

          {/* Headline */}
          <h1 className="font-display mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.25rem]">
            Khipu, la IA que entiende tus presupuestos de construcción
          </h1>

          {/* Subheadline */}
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Analiza APU, metrados, costos y catálogos dentro de MC Presupuestos para
            ayudarte a detectar inconsistencias, comparar alternativas y tomar mejores
            decisiones técnicas.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LandingLinkButton href="/register" className="gap-2">
              Probar Khipu IA
              <ArrowRight className="h-4 w-4" />
            </LandingLinkButton>
            <LandingLinkButton href="#como-funciona" variant="secondary">
              Ver cómo funciona
            </LandingLinkButton>
          </div>

          {/* Microcopy */}
          <p className="mt-5 text-sm text-slate-500">
            Siempre con revisión humana. Khipu recomienda, tú decides.
          </p>

          {/* Trust signals */}
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            {TRUST_SIGNALS.map((signal) => (
              <span
                key={signal}
                className="landing-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              >
                <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
