"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { Badge } from "@/components/ui/badge";

const trustSignals = [
  "Khipu IA integrada",
  "Trazabilidad entre presupuesto y APU",
  "Exportables listos para oficina tecnica",
];

const socialProof = [
  "Presupuesto, formula y cronograma en un solo flujo",
  "Revision asistida sin perder criterio tecnico",
  "Disenado para oficinas tecnicas que necesitan mas control",
];

export function HeroSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[58rem] bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_78%)]" />
      <div className="landing-shell relative flex w-full flex-col gap-12 pb-14 pt-28 md:pb-20 md:pt-32">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Badge className="w-fit border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-blue-700 uppercase">
            Plataforma conectada para presupuestos de obra
          </Badge>
          <h1 className="font-display mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
            La forma antigua de presupuestar obra ya no alcanza.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            MC Presupuestos conecta presupuesto, APU, metrados, formula polinomica, cronograma y exportables en un solo flujo tecnico. Khipu IA revisa, detecta y acelera decisiones con contexto real.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LandingLinkButton href="/register" className="gap-2">
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </LandingLinkButton>
            <LandingLinkButton href="#preview" variant="secondary">
              Ver plataforma
            </LandingLinkButton>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            {trustSignals.map((signal) => (
              <span key={signal} className="landing-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                {signal}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
            {socialProof.map((signal) => (
              <span
                key={signal}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-slate-600 shadow-sm shadow-slate-200/60"
              >
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                {signal}
              </span>
            ))}
          </div>
        </div>

        <motion.div
          initial={prefersReduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 48, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative mx-auto w-full max-w-[1000px]"
        >
          <div className="landing-surface-elevated relative overflow-hidden rounded-[1.75rem] bg-white p-2">
            <Image
              src="/hero-1.webp"
              alt="Dashboard de MC Presupuestos con resumen de proyectos, presupuesto total y acciones rápidas"
              width={1200}
              height={575}
              priority
              sizes="(min-width: 1024px) 1000px, (min-width: 768px) 92vw, 100vw"
              className="aspect-[1200/575] w-full rounded-[1.35rem] object-cover object-left-top"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
