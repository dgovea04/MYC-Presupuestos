import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";

type KhipuBadgeProps = {
  className?: string;
  /** Show sparkles icon instead of symbol for compact mode */
  compact?: boolean;
  /** Color variant — "light" for light backgrounds, "dark" for dark backgrounds */
  variant?: "light" | "dark";
};

function getVariantClassName(variant: KhipuBadgeProps["variant"]) {
  if (variant === "dark") {
    return "border-cyan-400/30 bg-white/10 text-cyan-200";
  }

  return "border-cyan-200 bg-cyan-50 text-slate-900";
}

function getIconClassName(variant: KhipuBadgeProps["variant"]) {
  if (variant === "dark") {
    return "text-cyan-400";
  }

  return "text-cyan-600";
}

export function KhipuBadge({ className, compact = false, variant = "light" }: KhipuBadgeProps) {
  const isDark = variant === "dark";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        getVariantClassName(variant),
        className,
      )}
    >
      {compact ? (
        <Sparkles className={cn("h-3 w-3", getIconClassName(variant))} />
      ) : (
        <KhipuSymbol className="h-4 w-4" variant={isDark ? "dark" : undefined} />
      )}
      IA
    </span>
  );
}
