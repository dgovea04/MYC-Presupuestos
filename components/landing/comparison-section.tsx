import { Check, Minus, X } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";

type ComparisonValue = "yes" | "partial" | "no";

const comparisonRows: Array<{ category: string; fragmentado: ComparisonValue; conectado: ComparisonValue }> = [
  { category: "Continuidad entre presupuesto y APU", fragmentado: "no", conectado: "yes" },
  { category: "Revision tecnica antes de exportar", fragmentado: "partial", conectado: "yes" },
  { category: "Cronograma y formula dentro del mismo flujo", fragmentado: "no", conectado: "yes" },
  { category: "Menos retrabajo por cambios manuales", fragmentado: "partial", conectado: "yes" },
  { category: "Contexto visible para asistencia con IA", fragmentado: "no", conectado: "yes" },
];

const comparisonStatusLabel: Record<ComparisonValue, string> = {
  yes: "Disponible",
  partial: "Parcial",
  no: "No disponible",
};

function ComparisonStatus({ value }: { value: ComparisonValue }) {
  if (value === "yes") {
    return (
      <>
        <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-4 w-4" />
        </span>
        <span className="sr-only">{comparisonStatusLabel[value]}</span>
      </>
    );
  }

  if (value === "partial") {
    return (
      <>
        <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Minus className="h-4 w-4" />
        </span>
        <span className="sr-only">{comparisonStatusLabel[value]}</span>
      </>
    );
  }

  return (
    <>
      <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <X className="h-4 w-4" />
      </span>
      <span className="sr-only">{comparisonStatusLabel[value]}</span>
    </>
  );
}

export function ComparisonSection() {
  return (
    <section id="comparison" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Comparacion operativa"
        title="No hace falta seguir cerrando el presupuesto en un flujo y terminandolo en otro."
        description="La diferencia no es cosmetica. Cambia la velocidad de revision, la trazabilidad y la calidad del cierre tecnico."
        align="center"
      />
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
        <span className="landing-chip rounded-full px-3 py-1.5">Comparacion de uso real</span>
        <span className="landing-chip rounded-full px-3 py-1.5">Menos retrabajo manual</span>
        <span className="landing-chip rounded-full px-3 py-1.5">Mas continuidad entre modulos</span>
      </div>
      <div className="landing-surface-elevated mt-14 overflow-hidden rounded-[1.9rem]">
        <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-6">
          <div>
            <p className="font-display text-[1.32rem] font-semibold tracking-tight text-slate-950">Comparativo de experiencia operativa</p>
            <p className="mt-2 max-w-2xl text-[0.98rem] leading-7 text-slate-500">
              La diferencia no es solo visual: cambia la forma de estructurar partidas, revisar costos y preparar entregables para obra.
            </p>
          </div>
        </div>
        <div role="table" aria-label="Comparativo de experiencia operativa" aria-colcount={3} aria-rowcount={comparisonRows.length + 1}>
          <div role="rowgroup">
            <div className="grid grid-cols-[1.45fr_repeat(2,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900" role="row">
              <div className="px-5 py-4" role="columnheader">
                Criterio
              </div>
              <div className="px-5 py-4 text-center" role="columnheader">
                Flujo fragmentado
              </div>
              <div className="bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)] px-5 py-4 text-center text-blue-700" role="columnheader">
                Flujo conectado
              </div>
            </div>
          </div>
          <div role="rowgroup">
            {comparisonRows.map((row, index) => (
              <div
                key={row.category}
                className={`grid grid-cols-[1.45fr_repeat(2,minmax(0,1fr))] items-center ${
                  index === comparisonRows.length - 1 ? "" : "border-b border-slate-100"
                }`}
                role="row"
              >
                <div className="px-5 py-5 text-sm font-medium text-slate-900" role="rowheader">
                  {row.category}
                </div>
                <div className="flex justify-center px-5 py-5" role="cell" aria-label={`Flujo fragmentado: ${comparisonStatusLabel[row.fragmentado]}`}>
                  <ComparisonStatus value={row.fragmentado} />
                </div>
                <div className="flex justify-center bg-blue-50/60 px-5 py-5" role="cell" aria-label={`Flujo conectado: ${comparisonStatusLabel[row.conectado]}`}>
                  <ComparisonStatus value={row.conectado} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
