import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AcquisitionCta } from "@/components/landing/acquisition/acquisition-cta";
import { PilotApplicationSection } from "@/components/landing/acquisition/pilot-application-section";
import { LandingLogo } from "@/components/landing/landing-logo";
import { BetaFreeBenefitsSection } from "@/components/landing/beta/beta-free-benefits-section";
import { BetaFreeHeroSection } from "@/components/landing/beta/beta-free-hero-section";
import { BetaFreeStepsSection } from "@/components/landing/beta/beta-free-steps-section";

export function BetaFreeLandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/beta-pro-gratis" aria-label="MC Presupuestos">
            <LandingLogo />
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegación beta">
            <Link href="#beneficios" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Beneficios</Link>
            <Link href="#como-funciona" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Cómo funciona</Link>
            <Link href="#solicitar" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Solicitar acceso</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <AcquisitionCta href="/login" location="beta_free_nav_login" variant="secondary" className="hidden px-3 py-2 sm:inline-flex">Iniciar sesión</AcquisitionCta>
            <AcquisitionCta href="#solicitar" location="beta_free_nav" className="px-3 py-2 sm:px-4">Pro gratis 60 días</AcquisitionCta>
          </div>
        </div>
      </header>

      <BetaFreeHeroSection />
      <BetaFreeBenefitsSection />
      <BetaFreeStepsSection />

      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
          <div>
            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Para los primeros usuarios</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Prueba tu próximo presupuesto con una base más clara.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Cuéntanos qué estás preparando y te ayudaremos a encontrar un primer caso de uso concreto para el piloto.</p>
          </div>
          <AcquisitionCta href="#solicitar" location="beta_free_mid_cta" className="gap-2">Quiero entrar al piloto <ArrowRight className="h-4 w-4" /></AcquisitionCta>
        </div>
      </section>

      <PilotApplicationSection
        sectionId="solicitar"
        landingVariant="beta-free-v1"
        ctaLocation="beta_free_form"
        eyebrow="Acceso Pro gratuito"
        title="Solicita tu acceso Pro gratis por 60 días."
        description="Déjanos tus datos y revisaremos si encajas en la primera cohorte de usuarios que probará MC Presupuestos con trabajo real. Luego crea y verifica tu cuenta con este mismo email."
        formTitle="Quiero probar Pro gratis"
        formSubtitle="Solicitud breve · sin tarjeta"
        submitLabel="Solicitar mi acceso gratuito"
      />

      <section className="bg-white py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <p className="mt-3 text-sm leading-6 text-slate-600">Sin tarjeta · sin cobro automático · acceso revisado manualmente · tus datos no se publican</p>
          <Link href="/software-presupuestos-construccion" className="mt-5 text-sm font-semibold text-blue-700 hover:text-blue-800">Conoce todas las capacidades de MC Presupuestos</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© {new Date().getFullYear()} MC Presupuestos</span>
          <span>Acceso Pro gratuito para usuarios fundadores en Perú.</span>
        </div>
      </footer>
    </main>
  );
}
