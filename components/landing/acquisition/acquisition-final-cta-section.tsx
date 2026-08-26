"use client";

import { ArrowRight } from "lucide-react";
import { AcquisitionCta } from "@/components/landing/acquisition/acquisition-cta";

export function AcquisitionFinalCtaSection() {
  return <section className="bg-slate-950 py-20 text-white md:py-24"><div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6 lg:px-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Empieza con tu próximo presupuesto</p><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Una forma más clara de comenzar a presupuestar.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Crea tu cuenta gratis y prueba el flujo con un presupuesto real. Si trabajas con un equipo, también puedes conversar con nosotros.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><AcquisitionCta href="/register" location="acquisition_final_cta" className="gap-2">Crear mi primer presupuesto gratis <ArrowRight className="h-4 w-4" /></AcquisitionCta><AcquisitionCta href="#piloto" location="acquisition_final_pilot_cta" variant="dark" onClick={() => window.dispatchEvent(new Event("open-pilot-dialog"))}>Conocer opción para equipos</AcquisitionCta></div></div></section>;
}
