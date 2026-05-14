import { cn } from "@/lib/utils";

export function ToneBadge({
  label,
  tone = "sky",
  bordered = false,
  className,
}: {
  label: string;
  tone?: "sky" | "slate" | "emerald" | "amber" | "rose" | "violet";
  bordered?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)] transition-colors",
        getToneBadgeClassName(tone, bordered),
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const config = getProjectStatusConfig(status);
  return <ToneBadge label={config.label} tone={config.tone} bordered />;
}

export function ContextBadge({
  label,
  tone = "sky",
}: {
  label: string;
  tone?: "sky" | "slate" | "emerald" | "amber" | "rose" | "violet";
}) {
  return <ToneBadge label={label} tone={tone} bordered />;
}

function getProjectStatusConfig(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return { label: "En ejecucion", tone: "emerald" as const };
    case "COMPLETED":
      return { label: "Completado", tone: "slate" as const };
    case "ON_HOLD":
      return { label: "En pausa", tone: "amber" as const };
    case "PLANNING":
    default:
      return { label: "Planificacion", tone: "sky" as const };
  }
}

function getToneBadgeClassName(
  tone: "sky" | "slate" | "emerald" | "amber" | "rose" | "violet",
  bordered: boolean,
) {
  if (tone === "slate") {
    return bordered ? "border border-slate-200 bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700";
  }

  if (tone === "emerald") {
    return bordered ? "border border-emerald-200 bg-emerald-100 text-emerald-700" : "bg-emerald-100 text-emerald-700";
  }

  if (tone === "amber") {
    return bordered ? "border border-amber-200 bg-amber-100 text-amber-700" : "bg-amber-100 text-amber-700";
  }

  if (tone === "rose") {
    return bordered ? "border border-rose-200 bg-rose-100 text-rose-700" : "bg-rose-100 text-rose-700";
  }

  if (tone === "violet") {
    return bordered ? "border border-violet-200 bg-violet-100 text-violet-700" : "bg-violet-100 text-violet-700";
  }

  return bordered ? "border border-sky-200 bg-sky-100 text-sky-700" : "bg-sky-100 text-sky-700";
}
