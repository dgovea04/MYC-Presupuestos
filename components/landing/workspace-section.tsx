import { History, ReceiptText, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";

const workspaceCapabilities = [
  {
    title: "Roles y permisos",
    description: "Define quién puede administrar el espacio de trabajo, editar presupuestos, revisar información o consultar entregables.",
    icon: ShieldCheck,
  },
  {
    title: "Invitaciones y acceso",
    description: "Invita a miembros por correo o enlace para sumar al equipo sin perder control sobre el acceso.",
    icon: UserPlus,
  },
  {
    title: "Auditoría del espacio de trabajo",
    description: "Consulta cambios relevantes de miembros, configuración y operación para mantener una historia revisable.",
    icon: History,
  },
  {
    title: "Facturación y uso por equipo",
    description: "Revisa el plan, seats y consumo desde el mismo espacio donde se organiza el trabajo técnico.",
    icon: ReceiptText,
  },
];

export function WorkspaceSection() {
  return (
    <section id="workspace" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Espacio de trabajo colaborativo"
        title="Una base común para que tu oficina técnica trabaje mejor."
        description="Administra miembros, roles, invitaciones, uso y cambios del equipo sin separar la operación técnica de la gestión del proyecto."
        align="center"
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <div className="landing-surface-contrast flex flex-col justify-between rounded-[2rem] p-7 text-white md:p-8">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-300">
              <UsersRound className="h-5 w-5" />
            </div>
            <h3 className="mt-7 max-w-md text-2xl font-semibold tracking-tight">La colaboración vive junto al presupuesto.</h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              Tu equipo puede trabajar con la misma estructura de proyectos, presupuestos, APUs y catálogos, con permisos claros y revisión humana en cada decisión técnica.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-sm">
            <div>
              <p className="font-semibold text-white">Roles</p>
              <p className="mt-1 text-slate-400">por responsabilidad</p>
            </div>
            <div>
              <p className="font-semibold text-white">Cambios</p>
              <p className="mt-1 text-slate-400">con trazabilidad</p>
            </div>
            <div>
              <p className="font-semibold text-white">Uso</p>
              <p className="mt-1 text-slate-400">visible por equipo</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {workspaceCapabilities.map((capability) => (
            <article key={capability.title} className="landing-surface-elevated rounded-[1.5rem] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <capability.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{capability.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
