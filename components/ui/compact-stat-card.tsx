import { cn } from "@/lib/utils";

export function CompactStatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "sky" | "slate" | "violet" | "rose" | "amber" | "emerald";
}) {
  const tones = {
    sky: "border-sky-100 bg-white/80 text-sky-700",
    slate: "border-slate-200 bg-white/80 text-slate-700",
    violet: "border-violet-100 bg-white/80 text-violet-700",
    rose: "border-rose-100 bg-white/80 text-rose-700",
    amber: "border-amber-100 bg-white/80 text-amber-700",
    emerald: "border-emerald-100 bg-white/80 text-emerald-700",
  } as const;

  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", tones[tone])}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
