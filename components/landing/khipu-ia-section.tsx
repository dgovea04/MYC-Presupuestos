import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import { KhipuLogo } from "@/components/khipu/KhipuLogo";
import { SectionHeading } from "@/components/landing/section-heading";

const reviewItems = [
  "Detecta inconsistencias visibles entre partida, unidad y costo.",
  "Sugiere focos de revision antes de exportar o cerrar.",
  "Acompana el analisis tecnico sin aplicar cambios por su cuenta.",
];

export function KhipuIASection() {
  return (
    <section id="khipu" className="landing-section landing-shell scroll-mt-28">
      <div className="landing-surface-contrast overflow-hidden rounded-[2rem] p-8 md:p-10">
        <SectionHeading
          badge="Khipu IA"
          title="Khipu IA revisa el presupuesto con contexto visible."
          description="No es un chat generico. Es una capa tecnica que entiende el presupuesto activo, ayuda a revisar APU y acelera decisiones sin romper el criterio del equipo."
          tone="dark"
          align="left"
        />
        <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <KhipuLogo showSubtitle={false} />
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                Revision contextual
              </span>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-300">
              Khipu cruza lo que el usuario esta viendo para ayudarte a revisar mejor antes de mover costos, emitir entregables o cerrar observaciones.
            </p>
          </div>
          <div className="space-y-3">
            {reviewItems.map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100">
                <div className="flex items-start gap-3">
                  {index === 1 ? <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-300" /> : index === 2 ? <Sparkles className="mt-0.5 h-4 w-4 text-blue-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />}
                  <span>{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
