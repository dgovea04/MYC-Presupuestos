import Image from "next/image";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LandingLinkButton } from "@/components/landing/landing-link-button";

const trustSignals = ["IA local revisable", "Cronograma valorizado", "Exportes PDF / Excel / ZIP"];

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[58rem] bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_78%)]" />
      <div className="landing-shell relative flex w-full flex-col gap-12 pb-14 pt-28 md:pb-20 md:pt-32">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Badge className="w-fit border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-blue-700 uppercase">
            Plataforma operativa para oficinas técnicas
          </Badge>
          <h1 className="font-display mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
            Presupuestos, APU, cronograma e IA en un solo flujo de obra.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            MYC conecta costos, partidas, insumos, fórmula polinómica, notas, exportes y programación para trabajar con trazabilidad sin depender de hojas dispersas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LandingLinkButton href="/register" className="gap-2">
              Crear presupuesto gratis
              <ArrowRight className="h-4 w-4" />
            </LandingLinkButton>
            <LandingLinkButton href="/login" variant="secondary">
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
        </div>

        <div className="relative mx-auto w-full max-w-[1000px]">
          <div className="landing-surface-elevated relative overflow-hidden rounded-[1.75rem] bg-white p-2">
            <div className="absolute left-6 top-6 z-10 hidden items-center gap-2 rounded-full border border-white/70 bg-white/88 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-200/70 backdrop-blur md:flex">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Vista global del dashboard
            </div>
            <Image
              src="/hero-1.png"
              alt="Dashboard de MYC Presupuestos con resumen de proyectos, presupuesto total y acciones rápidas"
              width={1200}
              height={575}
              priority
              sizes="(min-width: 1024px) 1000px, (min-width: 768px) 92vw, 100vw"
              className="aspect-[1200/575] w-full rounded-[1.35rem] object-cover object-left-top"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
