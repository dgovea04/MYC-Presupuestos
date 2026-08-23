import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { SectionHeading } from "@/components/landing/section-heading";

const reviewItems = [
  {
    text: "Detecta inconsistencias visibles entre partida, unidad y costo.",
    icon: CheckCircle2,
    iconClassName: "text-emerald-300",
  },
  {
    text: "Sugiere focos de revisión antes de exportar o cerrar.",
    icon: TriangleAlert,
    iconClassName: "text-amber-300",
  },
  {
    text: "Acompaña el análisis técnico sin aplicar cambios por su cuenta.",
    icon: Sparkles,
    iconClassName: "text-blue-300",
  },
];

export function KhipuIASection() {
  return (
    <section id="khipu" className="landing-section landing-shell scroll-mt-28">
      <div className="landing-surface-contrast overflow-hidden rounded-[2rem] p-8 md:p-10">
        <SectionHeading
          badge="Khipu IA"
          title="Khipu IA para revisar, explicar y avanzar con contexto técnico."
          description="Es el asistente técnico que entiende el presupuesto activo, ayuda a revisar APUs y acelera decisiones sin romper el criterio del equipo. Dentro de Khipu IA, el modo agente ayuda a crear y completar trabajo con aprobación humana."
          tone="dark"
        />
        <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <KhipuSymbol className="h-10 w-10" variant="dark" />
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight text-white">Khipu</p>
                  <p className="text-xs font-medium tracking-[0.12em] text-slate-300">Asistencia técnica visible sobre el presupuesto</p>
                </div>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                Revisión contextual
              </span>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-300">
              Khipu cruza lo que el usuario está viendo para ayudarte a revisar mejor antes de mover costos, emitir entregables o cerrar observaciones.
            </p>
            <div className="mt-6 rounded-2xl border border-blue-300/20 bg-blue-400/10 p-4" data-testid="khipu-agent-capability">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                <Sparkles className="h-4 w-4" />
                Khipu modo agente
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Crea partidas, propone APUs y prepara estructuras dentro del flujo. Tú revisas antes de aplicar cualquier cambio.
              </p>
            </div>

          </div>
          <ul className="space-y-3" aria-label="Capacidades de revisión de Khipu IA">
            {reviewItems.map((item) => (
              <li key={item.text} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100">
                <div className="flex items-start gap-3">
                  <item.icon className={`mt-0.5 h-4 w-4 ${item.iconClassName}`} />
                  <span>{item.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
