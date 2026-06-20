import { SectionHeading } from "@/components/landing/section-heading";
import { Card } from "@/components/ui/card";
import {
  FileSearch,
  FileText,
  GitCompareArrows,
  Lightbulb,
  Search,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Analiza presupuestos",
    description:
      "Revisa partidas, costos parciales, unidades y estructuras para identificar puntos que requieren atención.",
  },
  {
    icon: FileSearch,
    title: "Revisa APU",
    description:
      "Evalúa insumos, rendimientos, cuadrillas y coherencia técnica de cada análisis de precio unitario.",
  },
  {
    icon: GitCompareArrows,
    title: "Compara alternativas",
    description:
      "Ayuda a comparar soluciones, partidas similares o escenarios de costo sin modificar el presupuesto automáticamente.",
  },
  {
    icon: Lightbulb,
    title: "Sugiere mejoras",
    description:
      "Propone recomendaciones claras para optimizar costos, revisar cantidades o mejorar la trazabilidad.",
  },
  {
    icon: Zap,
    title: "Usa contexto del proyecto",
    description:
      "Responde con base en el presupuesto activo, la partida seleccionada y los catálogos disponibles.",
  },
  {
    icon: FileText,
    title: "Genera reportes técnicos",
    description:
      "Resume observaciones, riesgos y acciones sugeridas para revisión del equipo técnico.",
  },
];

export function KhipuFeatureGrid() {
  return (
    <section id="features" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Capacidades"
        title="Análisis técnico conectado a tu presupuesto."
        description="Khipu entiende el contexto de obra: partidas, APU, insumos, metrados y catálogos disponibles."
        align="center"
      />
      <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Card
            key={feature.title}
            className="landing-surface-elevated group relative overflow-hidden rounded-[2rem] p-7 transition duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_30px_80px_-42px_rgba(6,207,227,0.18)]"
          >
            <div className="absolute inset-x-0 top-0 h-24 rounded-t-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(6,207,227,0.1),transparent_62%)] opacity-60" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#cffafe_100%)] text-cyan-700 shadow-sm shadow-cyan-100/70 transition group-hover:scale-[1.03]">
                <feature.icon className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase">
                0{index + 1}
              </span>
            </div>
            <div className="relative">
              <h3 className="mt-6 font-display text-[1.35rem] font-semibold tracking-tight text-slate-950">
                {feature.title}
              </h3>
              <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-7 text-slate-600">
                {feature.description}
              </p>
            </div>
            <div className="relative mt-6 h-px bg-[linear-gradient(90deg,rgba(6,207,227,0.18),rgba(226,232,240,0.6),transparent)]" />
            <div className="relative mt-5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-500">Funcionalidad de Khipu</span>
              <span className="text-cyan-700 transition group-hover:translate-x-0.5">
                Ver detalle
              </span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
