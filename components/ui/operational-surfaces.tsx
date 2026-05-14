import type { ReactNode } from "react";

export function OperationalPanel({
  title,
  description,
  metrics,
  controls,
}: {
  title: string;
  description: string;
  metrics?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.95)_100%)] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.32)] transition-colors">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {metrics ? <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">{metrics}</div> : null}
      </div>
      {controls ? <div className="mt-4">{controls}</div> : null}
    </div>
  );
}

export function FormSectionPanel({
  title,
  description,
  children,
  icon,
}: {
  title: string;
  description: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.92)_100%)] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)] transition-colors">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-500">{icon}</span> : null}
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function FormActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_10px_25px_-22px_rgba(15,23,42,0.35)]">
      {children}
    </div>
  );
}
