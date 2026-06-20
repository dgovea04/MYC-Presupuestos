import { SectionHeading } from "@/components/landing/section-heading";
import {
  ClipboardList,
  FileSearch,
  FileText,
  Search,
  TrendingUp,
} from "lucide-react";

const USE_CASES = [
  {
    icon: FileSearch,
    title: "Revisión de presupuesto",
    prompt:
      "“Revisa este presupuesto y dime qué partidas requieren atención.”",
  },
  {
    icon: ClipboardList,
    title: "Análisis de APU",
    prompt:
      "“Genera recomendaciones para revisar este APU.”",
  },
  {
    icon: Search,
    title: "Control de metrados",
    prompt:
      "“Identifica posibles inconsistencias en cantidades y unidades.”",
  },
  {
    icon: TrendingUp,
    title: "Optimización de costos",
    prompt:
      "“Sugiere alternativas para reducir costos sin afectar el alcance.”",
  },
  {
    icon: FileText,
    title: "Reporte técnico",
    prompt:
      "“Resume las observaciones principales para el equipo de obra.”",
  },
];

export function KhipuUseCases() {
  return (
    <section className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Casos de uso"
        title="Ejemplos reales de interacción con Khipu."
        description="Prompts que puedes usar directamente dentro de MC Presupuestos para obtener análisis técnico inmediato."
        align="center"
      />
      <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2 xl:grid-cols-3">
        {USE_CASES.map((useCase) => {
          const Icon = useCase.icon;

          return (
            <div
              key={useCase.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-slate-950">
                  {useCase.title}
                </p>
              </div>
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600 italic">
                {useCase.prompt}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
