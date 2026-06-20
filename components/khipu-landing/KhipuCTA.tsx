import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";

export function KhipuCTA() {
  return (
    <section className="landing-section-tight mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="landing-surface-contrast overflow-hidden rounded-[2rem] px-6 py-12 text-white sm:px-10 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <KhipuSymbol className="mt-1 h-10 w-10 shrink-0" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Tu asistente IA de obra
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Khipu conecta datos, entiende tus proyectos y te ayuda a construir
                mejores decisiones.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                Prueba Khipu dentro de MC Presupuestos y lleva tu análisis técnico al
                siguiente nivel.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <LandingLinkButton
              href="/register"
              className="shadow-none hover:shadow-none"
            >
              Probar Khipu IA
            </LandingLinkButton>
            <LandingLinkButton href="/login" variant="secondary">
              Solicitar demostración
            </LandingLinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
