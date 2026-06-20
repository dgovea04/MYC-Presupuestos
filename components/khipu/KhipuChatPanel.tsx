"use client";

import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { Button } from "@/components/ui/button";

type KhipuChatPanelProps = {
  /** Panel children (messages, input, etc.) */
  children: ReactNode;
  /** Whether the panel is expanded/full-size */
  expanded?: boolean;
  /** Callback to close/minimize */
  onClose?: () => void;
  /** Callback to expand */
  onExpand?: () => void;
  /** Additional className for the outer container */
  className?: string;
  /** Additional inline styles (e.g. width/height for the floating panel) */
  style?: CSSProperties;
};

/**
 * Chat panel wrapper with Khipu branding header.
 *
 * Use this as the visual container for any Khipu chat experience:
 * floating assistant, /ai workspace, or landing page preview.
 */
export function KhipuChatPanel({
  children,
  expanded = false,
  onClose,
  onExpand,
  className,
  style,
}: KhipuChatPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10",
        expanded && "h-full",
        className,
      )}
      style={style}
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <KhipuSymbol className="h-9 w-9" />
          <div>
            <p className="font-display text-sm font-semibold text-slate-950">
              Khipu IA
            </p>
            <p className="text-xs text-khipu-muted">
              Tu asistente en MC Presupuestos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-lg p-0 text-slate-400 hover:text-slate-600"
              onClick={onExpand}
              aria-label={expanded ? "Minimizar" : "Expandir"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                {expanded ? (
                  <>
                    <path d="M5 2H2v3M9 12h3v-3M2 9v3h3M12 5V2H9" />
                  </>
                ) : (
                  <>
                    <path d="M9 2h3v3M5 12H2V9M12 9v3H9M2 5V2h3" />
                  </>
                )}
              </svg>
            </Button>
          ) : null}

          {onClose ? (
            <Button
              type="button"
              data-khipu-close
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-lg p-0 text-slate-400 hover:text-slate-600"
              onClick={onClose}
              aria-label="Cerrar Khipu"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
