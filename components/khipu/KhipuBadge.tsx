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

const VARIANT_CLASSES = {
  light: "border-cyan-200 bg-cyan-50 text-slate-900",
  dark: "border-cyan-400/30 bg-white/10 text-cyan-200",
} as const;

const ICON_CLASSES = {
  light: "text-cyan-600",
  dark: "text-cyan-400",
} as const;

export function KhipuBadge({ className, compact = false, variant = "light" }: KhipuBadgeProps) {
  const isDark = variant === "dark";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {compact ? (
        <Sparkles className={cn("h-3 w-3", ICON_CLASSES[variant])} />
      ) : (
        <KhipuSymbol className="h-4 w-4" variant={isDark ? "dark" : undefined} />
      )}
      IA
    </span>
  );
}
