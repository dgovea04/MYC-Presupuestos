"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, History, X, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { Button } from "@/components/ui/button";
import type { FloatingKhipuTheme } from "@/types/settings";

const headerIconButtonClassName =
  "h-8 w-8 rounded-lg p-0 transition-colors";

const lightHeaderIconButtonClassName =
  "text-slate-400 hover:bg-slate-100 hover:text-slate-600";

const darkHeaderIconButtonClassName =
  "text-slate-500 hover:bg-slate-800 hover:text-slate-200";

type KhipuChatPanelProps = {
  /** Panel children (messages, input, etc.) */
  children: ReactNode;
  /** Whether the panel is expanded/full-size */
  expanded?: boolean;
  /** Callback to close/minimize */
  onClose?: () => void;
  /** Callback to expand */
  onExpand?: () => void;
  /** Whether the history-only view is active */
  showHistory?: boolean;
  /** Callback to toggle history-only view */
  onToggleHistory?: () => void;
  /** Number of history entries (for badge) */
  historyCount?: number;
  /** Font size class for the panel body */
  fontSizeClass?: string;
  /** Additional className for the outer container */
  className?: string;
  /** Additional inline styles (e.g. width/height for the floating panel) */
  style?: CSSProperties;
  /** Visual theme for the panel */
  theme?: FloatingKhipuTheme;
  /** Callback to toggle between light and dark theme */
  onToggleTheme?: () => void;
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
  showHistory = false,
  onToggleHistory,
  historyCount,
  fontSizeClass,
  className,
  style,
  theme = "light",
  onToggleTheme,
}: KhipuChatPanelProps) {
  const isDark = theme === "dark";
  return (
    <div
      data-khipu-theme={theme}
      className={cn(
        "flex flex-col rounded-3xl border shadow-2xl transition-all duration-300",
        isDark ? "border-slate-700 bg-slate-900 shadow-slate-950/40" : "border-slate-200 bg-white shadow-slate-900/10",
        expanded && "h-full",
        className,
      )}
      style={style}
    >
      {/* Header */}
      <header className={cn(
        "flex shrink-0 items-center justify-between border-b px-5 py-4 transition-colors duration-300",
        isDark ? "border-slate-800" : "border-slate-100",
      )}>
        {showHistory ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                headerIconButtonClassName,
                isDark ? darkHeaderIconButtonClassName : lightHeaderIconButtonClassName,
              )}
              onClick={onToggleHistory}
              aria-label="Volver al chat"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <History className={cn("h-4 w-4", isDark ? "text-slate-400" : "text-slate-500")} />
              <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-slate-950")}>Historial</p>
              {historyCount ? (
                <span className={cn("inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold", isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}>
                  {historyCount}
                </span>
              ) : null}
            </div>
            <div /> {/* Spacer for flex between */}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <KhipuSymbol className="h-9 w-9" />
              <div>
                <p className={cn("font-display text-sm font-semibold", isDark ? "text-slate-100" : "text-slate-950")}>
                  Khipu IA
                </p>
                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-khipu-muted")}>
                  Tu asistente en MC Presupuestos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onToggleTheme ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    headerIconButtonClassName,
                    isDark ? darkHeaderIconButtonClassName : lightHeaderIconButtonClassName,
                  )}
                  onClick={onToggleTheme}
                  aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              ) : null}
              {onToggleHistory ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "relative",
                    headerIconButtonClassName,
                    isDark ? darkHeaderIconButtonClassName : lightHeaderIconButtonClassName,
                  )}
                  onClick={onToggleHistory}
                  aria-label="Ver historial"
                >
                  <History className="h-4 w-4" />
                  {historyCount ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                      {historyCount > 9 ? "9+" : historyCount}
                    </span>
                  ) : null}
                </Button>
              ) : null}
              {onExpand ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    headerIconButtonClassName,
                    isDark ? darkHeaderIconButtonClassName : lightHeaderIconButtonClassName,
                  )}
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
                  className={cn(
                    headerIconButtonClassName,
                    isDark ? darkHeaderIconButtonClassName : lightHeaderIconButtonClassName,
                  )}
                  onClick={onClose}
                  aria-label="Cerrar Khipu"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </>
        )}
      </header>

      {/* Body */}
      <div className={cn("flex-1 overflow-y-auto transition-colors duration-300", fontSizeClass, isDark && "text-slate-100")}>{children}</div>
    </div>
  );
}
