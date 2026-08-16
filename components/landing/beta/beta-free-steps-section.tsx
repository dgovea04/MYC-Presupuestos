import { CheckCircle2, ClipboardPenLine, MailCheck, Rocket, UserRoundCheck } from "lucide-react";

const steps = [
  { number: "01", title: "Déjanos tu nombre y email", text: "Completa una solicitud breve para saber quién quiere probar el flujo con trabajo real.", icon: ClipboardPenLine },
  { number: "02", title: "Crea y verifica tu cuenta", text: "Usa el mismo email de la solicitud para que podamos asociar tu acceso correctamente.", icon: MailCheck },
  { number: "03", title: "Revisamos tu solicitud", text: "Un Super Admin revisa cada caso y confirma el acceso de la cohorte fundadora.", icon: UserRoundCheck },
  { number: "04", title: "Empieza con Pro gratis", text: "Recibe el correo de aprobación y trabaja durante 60 días sin cobro automático.", icon: Rocket },
] as const;

export function BetaFreeStepsSection() {
  return (
    <section id="como-funciona" className="scroll-mt-24 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Cómo funciona</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Empieza sin complicar tu operación.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">El piloto está diseñado para que pruebes una parte real de tu trabajo antes de decidir si MC Presupuestos encaja en tu equipo.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map(({ number, title, text, icon: Icon }) => (
            <article key={number} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-blue-600">{number}</span><span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></span></div>
              <h3 className="mt-8 font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />No necesitas ingresar una tarjeta ni contratar una suscripción para participar en el piloto.</div>
      </div>
    </section>
  );
}
