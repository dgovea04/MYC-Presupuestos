import { AlertTriangle, FileSpreadsheet, GitBranch, ScanSearch } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";

const painPoints = [
  {
    title: "Versiones dispersas",
    description: "Presupuesto, APU, observaciones y exportes viven en archivos distintos y pierden continuidad.",
    icon: FileSpreadsheet,
  },
  {
    title: "Retrabajo manual",
    description: "El equipo repite ajustes entre partidas, analisis unitarios y entregables finales.",
    icon: GitBranch,
  },
  {
    title: "Revision lenta",
    description: "Las inconsistencias tecnicas aparecen tarde, cuando el presupuesto ya esta circulando.",
    icon: ScanSearch,
  },
];

export function LegacyPainSection() {
  return (
    <section id="pain" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Flujo heredado"
        title="El problema no es calcular menos. Es coordinar mejor."
        description="Cuando el presupuesto vive fragmentado, la revision se vuelve mas lenta, el retrabajo sube y la trazabilidad tecnica se debilita."
        align="center"
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {painPoints.map((point) => (
          <article key={point.title} className="landing-surface-elevated rounded-[2rem] p-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <point.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold tracking-tight text-slate-950">{point.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{point.description}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        La friccion no viene de una sola tarea. Viene del flujo completo.
      </div>
    </section>
  );
}
