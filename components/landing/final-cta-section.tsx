import { LandingLinkButton } from "@/components/landing/landing-link-button";

export function FinalCTASection() {
  return (
    <section className="landing-section-tight mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="landing-surface-contrast overflow-hidden rounded-[2rem] px-6 py-12 text-white sm:px-10 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Empieza con una base mas moderna</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Lleva tus presupuestos, APUs y reportes a una experiencia hecha para construir con mas orden.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              MYC Presupuestos ayuda a equipos tecnicos a dejar atras hojas dispersas y software lento, sin perder el detalle que exige una obra real.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <LandingLinkButton href="/register" className="shadow-none hover:shadow-none">
              Crear cuenta
            </LandingLinkButton>
            <LandingLinkButton href="/login" variant="secondary">
              Ingresar a la plataforma
            </LandingLinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
