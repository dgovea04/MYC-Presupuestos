import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { LandingV2Button } from "@/components/landing-v2/landing-v2-button";
import { TerminalWorkbench } from "@/components/landing-v2/terminal-workbench";

export function LandingV2Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[#1a1a1a] bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24 lg:py-28">
      <div className="absolute inset-x-0 top-16 mx-auto h-96 max-w-3xl rounded-full bg-[#1a26ff]/25 blur-3xl" />
      <div className="relative mx-auto max-w-[1200px] text-center">
        <div className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[#333333] bg-[#181818] px-3 py-1.5 text-center text-xs font-medium text-[#a8a8a8]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#33d17a]" aria-hidden="true" />
          <span className="min-w-0 truncate">Plataforma moderna de costos y presupuestos de obra</span>
        </div>
        <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-medium tracking-[-0.015em] text-white sm:text-6xl lg:text-7xl lg:leading-[1.05]">
          Presupuestos de obra con la precision de una terminal tecnica.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#a8a8a8] sm:text-lg">
          MC Presupuestos unifica presupuestos, APU, catalogo de insumos, formula polinomica, programacion y reportes en una experiencia SaaS para oficinas tecnicas.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <LandingV2Button href="/register" showArrow className="w-full sm:w-auto">
            Empezar con MC
          </LandingV2Button>
          <LandingV2Button href="/login" variant="outline" className="w-full sm:w-auto">
            Ver plataforma
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </LandingV2Button>
        </div>
        <TerminalWorkbench />
      </div>
    </section>
  );
}
