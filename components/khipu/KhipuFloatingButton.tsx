"use client";

import { cn } from "@/lib/utils";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";

type KhipuFloatingButtonProps = {
  /** Whether the assistant panel is open */
  open: boolean;
  /** Toggle callback */
  onClick: () => void;
  className?: string;
};

/**
 * Floating circular button with the Khipu symbol.
 *
 * Used as the floating assistant launcher in the main app layout.
 */
export function KhipuFloatingButton({
  open,
  onClick,
  className,
}: KhipuFloatingButtonProps) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        data-khipu-launcher
        aria-expanded={open}
        aria-label={open ? "Cerrar Khipu" : "Abrir Khipu"}
        className="flex h-15 w-15 items-center justify-center rounded-[99px] bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2"
        onClick={onClick}
      >
        <KhipuSymbol className="h-15 w-15" />
      </button>
    </div>
  );
}
