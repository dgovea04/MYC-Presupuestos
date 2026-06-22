import Link from "next/link";
import { cn } from "@/lib/utils";

export function FilterPillLink({
  href,
  label,
  count,
  active,
  tone = "slate",
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone?: "slate" | "rose" | "amber";
}) {
  const palette = getFilterPillPalette(tone);

  return (
    <Link
      href={href}
      className={cn(
        "filter-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition",
        `filter-pill-${tone}`,
        active ? "filter-pill-active" : "filter-pill-inactive",
        active ? palette.active : palette.inactive,
      )}
    >
      {label}
      <span
        className={cn(
          "filter-pill-count rounded-full px-2 py-0.5 text-[11px] font-semibold",
          active ? "filter-pill-count-active" : "filter-pill-count-inactive",
          active ? palette.activeCount : palette.inactiveCount,
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function getFilterPillPalette(tone: "slate" | "rose" | "amber") {
  if (tone === "rose") {
    return {
      active: "bg-rose-600 !text-white hover:bg-rose-700",
      inactive: "border border-rose-200 bg-[var(--app-surface)] text-rose-700 hover:border-rose-300 hover:bg-rose-50",
      activeCount: "bg-white/15 !text-white",
      inactiveCount: "bg-rose-100 text-rose-700",
    };
  }

  if (tone === "amber") {
    return {
      active: "bg-amber-500 !text-white hover:bg-amber-600",
      inactive: "border border-amber-200 bg-[var(--app-surface)] text-amber-700 hover:border-amber-300 hover:bg-amber-50",
      activeCount: "bg-white/15 !text-white",
      inactiveCount: "bg-amber-100 text-amber-700",
    };
  }

  return {
    active: "bg-slate-900 !text-white hover:bg-slate-800",
    inactive: "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-sky-300 hover:bg-[var(--app-primary-muted)] hover:text-sky-700",
    activeCount: "bg-white/15 !text-white",
    inactiveCount: "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]",
  };
}
