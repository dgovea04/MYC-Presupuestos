import { cn } from "@/lib/utils";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";

type KhipuLogoProps = {
  className?: string;
  /** Show subtitle text */
  showSubtitle?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
};

const SIZE_MAP = {
  sm: { symbol: "h-7 w-7", title: "text-base", subtitle: "text-[10px]" },
  md: { symbol: "h-9 w-9", title: "text-lg", subtitle: "text-[11px]" },
  lg: { symbol: "h-12 w-12", title: "text-2xl", subtitle: "text-xs" },
} as const;

export function KhipuLogo({ className, showSubtitle = true, size = "md" }: KhipuLogoProps) {
  const sizes = SIZE_MAP[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <KhipuSymbol className={sizes.symbol} />
      <div>
        <p className={cn("font-display font-semibold tracking-tight text-slate-950", sizes.title)}>
          Khipu
        </p>
        {showSubtitle ? (
          <p className={cn("text-khipu-muted", sizes.subtitle)}>
            Asistente IA de MC Presupuestos
          </p>
        ) : null}
      </div>
    </div>
  );
}
