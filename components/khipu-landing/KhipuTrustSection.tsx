import { SectionHeading } from "@/components/landing/section-heading";
import { ShieldCheck } from "lucide-react";

const PRINCIPLES = [
  "No modifica presupuestos automáticamente.",
  "No inventa precios exactos.",
  "Declara supuestos cuando falta información.",
  "Recomienda acciones para revisión humana.",
  "Mantiene lenguaje técnico claro.",
];

export function KhipuTrustSection() {
  return (
    <section className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Confianza"
        title="IA diseñada para presupuestos, no para respuestas genéricas."
        description="Khipu está pensado para trabajar dentro del flujo real de MC Presupuestos: proyectos, partidas, APU, insumos, metrados y reportes. Sus respuestas deben ser técnicas, trazables y siempre sujetas a revisión humana."
        align="center"
      />

      <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PRINCIPLES.map((principle) => (
          <div
            key={principle}
            className="flex items-start gap-3 rounded-xl border border-green-100 bg-green-50/70 px-4 py-3.5 transition hover:border-green-200 hover:bg-green-50"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <span className="text-sm font-medium leading-6 text-slate-800">
              {principle}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
