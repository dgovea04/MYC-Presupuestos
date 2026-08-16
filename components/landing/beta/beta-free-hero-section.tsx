import { ArrowRight, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { AcquisitionCta } from "@/components/landing/acquisition/acquisition-cta";

export function BetaFreeHeroSection() {
  return (
    <section className="overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(37,99,235,0.16),transparent_34%),linear-gradient(180deg,#fff_0%,#f8fafc_100%)]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-32 sm:px-6 md:pb-28 md:pt-40 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:px-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700"><ShieldCheck className="h-3.5 w-3.5" />Cohorte fundadora · Perú</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[4.15rem] lg:leading-[1.03]">Usa Pro gratis durante 60 días en tu próximo presupuesto de obra.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Estamos invitando a los primeros profesionales peruanos a probar MC Presupuestos con trabajo real. Sin tarjeta, sin cobro automático y con acompañamiento para comenzar.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AcquisitionCta href="#solicitar" location="beta_free_hero" className="gap-2">Quiero probar Pro gratis <ArrowRight className="h-4 w-4" /></AcquisitionCta>
            <AcquisitionCta href="/software-presupuestos-construccion" location="beta_free_platform" variant="secondary">Conocer la plataforma</AcquisitionCta>
          </div>
          <div className="mt-7 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <Proof icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} text="60 días de Pro" />
            <Proof icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} text="Sin tarjeta" />
            <Proof icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} text="Revisión manual" />
          </div>
        </div>
        <div className="relative rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.7)]">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900 p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-sky-300" /><span className="text-sm font-semibold text-white">Tu presupuesto de obra</span></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">Listo para revisar</span></div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-xs"><Metric label="Costo directo" value="S/ 842,560" /><Metric label="Partidas" value="128" /><Metric label="APU" value="96%" /></div>
            <div className="mt-5 space-y-3"><BudgetRow label="01.01 Movimiento de tierras" value="S/ 124,800" tone="bg-sky-400" /><BudgetRow label="02.03 Concreto armado" value="S/ 318,420" tone="bg-emerald-400" /><BudgetRow label="03.01 Arquitectura" value="S/ 196,240" tone="bg-amber-400" /></div>
            <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-400/10 p-3 text-xs leading-5 text-blue-100"><span className="font-semibold text-blue-300">Flujo conectado:</span> presupuesto, APU, metrados y fórmula polinómica en una misma base técnica.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Proof({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span className="inline-flex items-center gap-2">{icon}{text}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>;
}

function BudgetRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-slate-300"><span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />{label}</span><span className="shrink-0 font-medium text-white">{value}</span></div>;
}
