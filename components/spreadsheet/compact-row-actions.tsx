"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 176;
const VIEWPORT_PADDING = 12;
const MENU_OFFSET = 4;

type MenuPosition = { top: number; left: number };

function getMenuPosition(trigger: HTMLElement, menu: HTMLElement | null, actionCount: number): MenuPosition {
  const triggerRect = trigger.getBoundingClientRect();
  const menuWidth = menu?.offsetWidth || MENU_WIDTH;
  const menuHeight = menu?.offsetHeight || actionCount * 32 + 8;
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - menuWidth - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - menuHeight - VIEWPORT_PADDING);
  const shouldOpenUp = triggerRect.bottom + MENU_OFFSET + menuHeight > window.innerHeight && triggerRect.top > menuHeight;
  const top = shouldOpenUp ? triggerRect.top - menuHeight - MENU_OFFSET : triggerRect.bottom + MENU_OFFSET;

  return {
    top: Math.max(VIEWPORT_PADDING, Math.min(top, maxTop)) + window.scrollY,
    left: Math.max(VIEWPORT_PADDING, Math.min(triggerRect.right - menuWidth, maxLeft)) + window.scrollX,
  };
}

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
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setPosition(null);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setPosition(null);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      setPosition(getMenuPosition(triggerRef.current, menuRef.current, actions.length));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [actions.length, open]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      setPosition(null);
      return;
    }

    if (triggerRef.current) setPosition(getMenuPosition(triggerRef.current, null, actions.length));
    setOpen(true);
  }

  return (
    <div ref={containerRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={triggerLabel}
          className="absolute z-[120] min-w-44 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg"
          style={{ top: position.top, left: position.left }}
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
                setPosition(null);
                action.onSelect();
              }}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
