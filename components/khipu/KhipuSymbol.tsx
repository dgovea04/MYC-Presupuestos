import { cn } from "@/lib/utils";

type KhipuSymbolProps = {
  className?: string;
  /** Use dark background variant with navy fill */
  variant?: "default" | "dark" | "mono";
};

/**
 * Core Khipu brand symbol.
 *
 * Renders the khipu-1.svg icon as an image. Variants control the
 * surrounding presentation: dark adds a navy rounded backdrop with
 * a brightness boost so the outer envelope remains visible, mono
 * desaturates the image for neutral contexts.
 */
export function KhipuSymbol({ className, variant = "default" }: KhipuSymbolProps) {
  const isDark = variant === "dark";
  const isMono = variant === "mono";

  if (isDark) {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-xl bg-[#0D134D]", className)}>
        <img
          src="/khipu-1.svg"
          alt=""
          className="h-full w-full brightness-[1.6] contrast-[1.15]"
          aria-hidden="true"
        />
      </span>
    );
  }

  return (
    <img
      src="/khipu-1.svg"
      alt=""
      className={cn("h-auto w-auto", isMono && "grayscale", className)}
      aria-hidden="true"
    />
  );
}
