import { cn } from "@/lib/utils";

export function InfoCard({
  label,
  value,
  tone = "slate",
  layout = "stacked",
}: {
  label: string;
  value: string;
  tone?: "slate" | "sky" | "amber";
  layout?: "stacked" | "inline";
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200 bg-sky-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.38)] transition-colors",
        toneClass,
        layout === "inline" ? "flex items-center justify-between gap-3" : "space-y-1",
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn("font-semibold tracking-tight text-slate-900", layout === "inline" ? "text-sm" : "text-lg")}>{value}</p>
    </div>
  );
}
