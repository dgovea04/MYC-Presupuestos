import { LandingLinkButton } from "@/components/landing/landing-link-button";

export function FinalCTASection() {
  return (
    <section className="landing-section-tight mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="landing-surface-contrast overflow-hidden rounded-[2rem] px-6 py-12 text-white sm:px-10 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Empieza con un flujo de obra conectado</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Menos tiempo organizando hojas. Más tiempo gestionando proyectos.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Prueba MYC Presupuestos y centraliza tu flujo técnico en una sola plataforma.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <LandingLinkButton href="/register" className="shadow-none hover:shadow-none">
              Crear cuenta gratis
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
