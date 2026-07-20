"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompactRowAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

export function CompactRowActions({
  actions,
  className,
  triggerLabel = "Abrir acciones de fila",
}: {
  actions: CompactRowAction[];
  className?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={triggerLabel}
          className="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
