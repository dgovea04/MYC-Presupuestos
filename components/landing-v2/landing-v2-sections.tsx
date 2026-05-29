import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Minus, Star } from "lucide-react";
import {
  comparisonRows,
  landingV2BenefitItems,
  landingV2FeatureItems,
  landingV2FooterLinks,
  landingV2PricingPlans,
  landingV2Testimonials,
  previewRows,
  toolkitItems,
  workflowItems,
} from "@/components/landing-v2/landing-v2-content";
import { LandingV2Button } from "@/components/landing-v2/landing-v2-button";
import { SectionHeading } from "@/components/landing-v2/section-heading";

function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#222222] bg-[#181818] ${className}`}>{children}</div>;
}

export function LandingV2FeaturesSection() {
  return (
    <section id="producto" className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading
          badge="Módulos clave"
          title="Todo el flujo de costos de obra en una sola superficie oscura y clara."
          description="La version v2 prueba una presencia mas tecnica: menos brochure, mas consola operativa para presupuestos, APU, catalogos, reportes y reajustes."
          align="center"
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {landingV2FeatureItems.map((feature, index) => (
            <SurfaceCard key={feature.title} className="p-7 transition hover:border-[#333333] hover:bg-[#1d1d1d]">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#222222] text-white">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-[#666666]">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#a8a8a8]">{feature.description}</p>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV2ProductPreviewSection() {
  return (
    <section className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <SectionHeading
            badge="Vista de producto"
            title="Lectura tipo hoja de costos, con contexto que no se pierde."
            description="La tabla central mantiene la familiaridad de Excel, mientras los paneles de control resaltan totales, incidencias y estado tecnico."
          />
          <SurfaceCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222222] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">Presupuesto de estructuras</p>
                <p className="mt-1 text-xs text-[#888888]">Edificio Miraflores 12 / version v4</p>
              </div>
              <span className="rounded-full bg-[#222222] px-3 py-1 text-xs font-medium text-[#33d17a]">Sin alertas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] text-sm">
                <thead className="bg-black text-[#888888]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Descripcion</th>
                    <th className="px-4 py-3 text-left font-medium">Und.</th>
                    <th className="px-4 py-3 text-right font-medium">Metrado</th>
                    <th className="px-4 py-3 text-right font-medium">P.U.</th>
                    <th className="px-4 py-3 text-right font-medium">Parcial</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.code} className="border-t border-[#222222]">
                      <td className="px-4 py-3 font-mono text-xs text-[#888888]">{row.code}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.item}</td>
                      <td className="px-4 py-3 text-[#a8a8a8]">{row.unit}</td>
                      <td className="px-4 py-3 text-right text-[#a8a8a8]">{row.qty}</td>
                      <td className="px-4 py-3 text-right text-[#a8a8a8]">{row.price}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </section>
  );
}

export function LandingV2WorkflowSection() {
  return (
    <section id="flujo" className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading
          badge="Flujo tecnico"
          title="De presupuesto base a reportes, sin saltar entre archivos."
          description="Cada paso conserva trazabilidad y prepara los datos para control de obra, reajustes y entregables."
          align="center"
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {workflowItems.map((item) => (
            <SurfaceCard key={item.title} className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#222222] text-white">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#a8a8a8]">{item.description}</p>
            </SurfaceCard>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {toolkitItems.map((item) => (
            <SurfaceCard key={item.title} className="flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#222222] text-white">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-[#888888]">{item.description}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV2ComparisonSection() {
  return (
    <section id="comparacion" className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading
          badge="Comparacion"
          title="Mas orden que Excel, menos friccion que el software tradicional."
          description="La prueba v2 comunica esa diferencia desde una estetica mas tecnica y directa."
          align="center"
        />
        <SurfaceCard className="mt-12 overflow-hidden">
          <div className="grid min-w-[720px] grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] border-b border-[#222222] bg-black text-sm font-semibold text-white">
            <div className="px-5 py-4">Criterio</div>
            <div className="px-5 py-4 text-center">Excel</div>
            <div className="px-5 py-4 text-center">Software tradicional</div>
            <div className="bg-[#0007cd] px-5 py-4 text-center">MYC Presupuestos</div>
          </div>
          <div className="overflow-x-auto">
            {comparisonRows.map((row) => (
              <div key={row.label} className="grid min-w-[720px] grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] border-b border-[#222222] last:border-b-0">
                <div className="px-5 py-4 text-sm font-medium text-white">{row.label}</div>
                <div className="px-5 py-4 text-center text-sm text-[#a8a8a8]">{row.excel}</div>
                <div className="px-5 py-4 text-center text-sm text-[#a8a8a8]">{row.traditional}</div>
                <div className="bg-[#0007cd]/18 px-5 py-4 text-center text-sm font-semibold text-white">{row.myc}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </section>
  );
}

export function LandingV2BenefitsSection() {
  return (
    <section className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="relative overflow-hidden rounded-2xl border border-[#222222] bg-[#181818] p-8 md:p-12">
          <div className="absolute inset-x-12 top-1/2 h-64 -translate-y-1/2 rounded-full bg-[#1a26ff]/22 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHeading
              badge="Beneficios"
              title="Rigor tecnico sin cargar la operacion."
              description="Pensado para equipos que necesitan precision financiera, continuidad entre módulos y entregables claros para obra."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {landingV2BenefitItems.map((benefit) => (
                <div key={benefit.title} className="rounded-xl border border-[#333333] bg-[#0f0f0f] p-5">
                  <benefit.icon className="h-5 w-5 text-white" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-semibold text-white">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#a8a8a8]">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingV2TestimonialsSection() {
  return (
    <section className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading
          badge="Testimonios"
          title="Comentarios que suenan a obra, no a brochure."
          description="Historias breves de profesionales que necesitan velocidad, trazabilidad y menos dependencia de hojas dispersas."
          align="center"
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {landingV2Testimonials.map((testimonial) => (
            <SurfaceCard key={testimonial.name} className="p-6">
              <div className="flex gap-1 text-[#f59e0b]" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={`${testimonial.name}-${index}`} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-5 text-sm leading-7 text-[#d6d6d6]">
                &quot;{testimonial.quote}&quot;
              </p>
              <div className="mt-6 border-t border-[#222222] pt-5">
                <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                <p className="mt-1 text-sm text-[#888888]">{testimonial.role}</p>
                <p className="text-sm text-[#666666]">{testimonial.company}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV2PricingSection() {
  return (
    <section id="precios" className="bg-[#0f0f0f] px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeading
          badge="Precios"
          title="Planes claros para profesionales, oficinas tecnicas y constructoras."
          description="El objetivo de la prueba es comparar si una pagina mas tecnica mejora conversion frente a la version SaaS premium actual."
          align="center"
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {landingV2PricingPlans.map((plan) => (
            <SurfaceCard key={plan.name} className={`p-7 ${plan.highlight ? "border-[#0007cd] bg-[#101036]" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{plan.name}</p>
                  <p className="mt-3 text-sm leading-6 text-[#a8a8a8]">{plan.description}</p>
                </div>
                {plan.highlight ? (
                  <span className="rounded-full bg-[#0007cd] px-3 py-1 text-xs font-medium text-white">Recomendado</span>
                ) : null}
              </div>
              <div className="mt-7">
                {plan.originalPrice ? <p className="text-sm text-[#666666] line-through">{plan.originalPrice}</p> : null}
                <p className="text-4xl font-medium tracking-[-0.015em] text-white">{plan.price}</p>
              </div>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex gap-3 text-sm leading-6 text-[#d6d6d6]">
                    {plan.highlight ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#33d17a]" aria-hidden="true" />
                    ) : (
                      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#888888]" aria-hidden="true" />
                    )}
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <LandingV2Button href="/register" variant={plan.highlight ? "primary" : "secondary"} className="mt-8 w-full">
                {plan.name === "Empresa" ? "Solicitar acceso" : "Elegir plan"}
              </LandingV2Button>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV2FinalCtaSection() {
  return (
    <section className="relative overflow-hidden bg-[#0f0f0f] px-4 py-20 text-center sm:px-6 md:py-24">
      <div className="absolute inset-x-0 top-1/2 mx-auto h-72 max-w-2xl -translate-y-1/2 rounded-full bg-[#1a26ff]/25 blur-3xl" />
      <div className="relative mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[#a8a8a8] uppercase">Empieza con una base mas moderna</p>
        <h2 className="mt-5 text-3xl font-medium tracking-[-0.015em] text-white sm:text-5xl">
          Lleva tus presupuestos, APUs y reportes a una experiencia hecha para construir con mas orden.
        </h2>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LandingV2Button href="/register" showArrow>
            Crear cuenta
          </LandingV2Button>
          <LandingV2Button href="/login" variant="secondary">
            Ingresar a la plataforma
          </LandingV2Button>
        </div>
      </div>
    </section>
  );
}

const footerLinkMap: Record<string, string> = {
  "Presupuesto y APU": "#producto",
  "IA local": "#flujo",
  Cronograma: "#flujo",
  Exportaciones: "#producto",
  Presupuestos: "#producto",
  APU: "#producto",
  "Fórmula polinómica": "#flujo",
  Reportes: "#producto",
  Nosotros: "#comparacion",
  Clientes: "#comparacion",
  Seguridad: "#precios",
  Contacto: "#contacto",
  Demo: "#producto",
  "Guia de inicio": "/register",
  "Guía de inicio": "/register",
  "Casos de uso": "#comparacion",
  Soporte: "#contacto",
};

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item}>
            <Link href={footerLinkMap[item] ?? "/"} className="text-sm text-[#888888] transition hover:text-white">
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingV2Footer() {
  return (
    <footer id="contacto" className="border-t border-[#222222] bg-[#0f0f0f] px-4 py-14 sm:px-6">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1.2fr_repeat(3,0.75fr)]">
        <div>
          <p className="text-lg font-semibold text-white">MYC Presupuestos</p>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#888888]">
            Plataforma moderna de costos y presupuestos de obra para ingenieros, contratistas y oficinas tecnicas.
          </p>
          <p className="mt-6 text-sm text-[#666666]">&copy; 2026 MYC Presupuestos. Todos los derechos reservados.</p>
        </div>
        <FooterColumn title="Producto" items={landingV2FooterLinks.producto} />
        <FooterColumn title="Empresa" items={landingV2FooterLinks.empresa} />
        <FooterColumn title="Recursos" items={landingV2FooterLinks.recursos} />
      </div>
    </footer>
  );
}
