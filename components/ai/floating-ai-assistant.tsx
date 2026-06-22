"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useActiveAiViewContext, type AiViewContextValue } from "@/components/ai/ai-view-context";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { KhipuChatPanel } from "@/components/khipu/KhipuChatPanel";
import { KhipuFloatingButton } from "@/components/khipu/KhipuFloatingButton";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { mergeKhipuFields } from "@/lib/settings/khipu-fields";
import type { FloatingKhipuFontSize, FloatingKhipuPosition, FloatingKhipuTheme } from "@/types/settings";

type FloatingAiAssistantProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FONT_SIZE_MAP: Record<FloatingKhipuFontSize, string> = {
  compact: "text-[11px]",
  normal: "text-sm",
  large: "text-base",
};

const THEME_STORAGE_KEY = "myc-khipu-theme";

function readStoredTheme(): FloatingKhipuTheme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

const POSITION_STYLE: Record<FloatingKhipuPosition, React.CSSProperties> = {
  "bottom-right": { right: "1.25rem", bottom: "1.25rem" },
  "bottom-left": { left: "1.25rem", bottom: "1.25rem" },
  "top-right": { right: "1.25rem", top: "1.25rem" },
  "top-left": { left: "1.25rem", top: "1.25rem" },
};

export function FloatingAiAssistant({ open, onOpenChange }: FloatingAiAssistantProps) {
  const viewContext = useActiveAiViewContext();
  const controllerKey = readViewContextIdentity(viewContext);
  const prefersReducedMotion = useReducedMotion();
  const formatSettings = useFormattingSettings();
  const [khipuSettings, setKhipuSettings] = useState(formatSettings);
  const { size, onResizeStart } = useResizablePanel("myc-khipu-panel-size-v2", {
    width: khipuSettings.floatingKhipuWidth,
    height: khipuSettings.floatingKhipuHeight,
  });
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [theme, setTheme] = useState<FloatingKhipuTheme>(() => readStoredTheme() ?? khipuSettings.floatingKhipuTheme);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error(`Settings fetch failed (${res.status})`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        setKhipuSettings((prev) => mergeKhipuFields(prev, data as Record<string, unknown>));
      })
      .catch(() => {
        // Silently keep defaults - the user may not be authenticated yet.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === "object") {
        setKhipuSettings((prev) => mergeKhipuFields(prev, detail as Record<string, unknown>));
      }
    };

    window.addEventListener("khipu-settings-changed", handleSettingsChange);
    return () => window.removeEventListener("khipu-settings-changed", handleSettingsChange);
  }, []);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    setTheme(khipuSettings.floatingKhipuTheme);
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  }, [khipuSettings.floatingKhipuTheme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  }, []);

  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 450, damping: 30, mass: 0.8 };

  const buttonTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 25 };

  const positionStyle = POSITION_STYLE[khipuSettings.floatingKhipuPosition];
  const containerStyle = expanded
    ? { position: "fixed" as const, inset: "1rem" }
    : { position: "fixed" as const, ...positionStyle };
  const fontSizeClass = FONT_SIZE_MAP[khipuSettings.floatingKhipuFontSize];
  const isDark = theme === "dark";

  return (
    <div
      data-khipu-panel
      className={cn("z-[60] flex flex-col gap-3", expanded ? "items-stretch" : "items-end")}
      style={containerStyle}
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            className={expanded ? "flex min-h-0 flex-1" : ""}
            initial={expanded ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
            animate={expanded ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={panelTransition}
          >
            <KhipuChatPanel
              className={cn("pointer-events-auto", expanded && "h-full w-full")}
              style={expanded ? undefined : { width: size.width, maxHeight: size.height }}
              fontSizeClass={fontSizeClass}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              expanded={expanded}
              showHistory={showHistory}
              historyCount={historyCount}
              onToggleHistory={() => setShowHistory(!showHistory)}
              onExpand={() => setExpanded(!expanded)}
              onClose={() => onOpenChange(false)}
            >
              {!expanded ? (
                <div
                  className="group absolute left-0 top-0 z-10 flex h-8 w-8 cursor-nwse-resize items-start justify-start rounded-tl-3xl pt-0.5 pl-0.5 opacity-0 transition-opacity hover:opacity-100"
                  onMouseDown={onResizeStart}
                  onTouchStart={onResizeStart}
                  aria-label="Redimensionar panel"
                >
                  <span className="flex gap-[2px]">
                    <span className={cn("block h-[3px] w-[3px] rounded-full transition-colors", isDark ? "bg-[var(--khipu-dark-muted-soft)] group-hover:bg-[var(--khipu-dark-muted)]" : "bg-slate-300 group-hover:bg-slate-400")} />
                    <span className={cn("block h-[3px] w-[3px] rounded-full transition-colors", isDark ? "bg-[var(--khipu-dark-muted-soft)] group-hover:bg-[var(--khipu-dark-muted)]" : "bg-slate-300 group-hover:bg-slate-400")} />
                  </span>
                  <span className="-mt-[2px] flex gap-[2px]">
                    <span className={cn("block h-[3px] w-[3px] rounded-full transition-colors", isDark ? "bg-[var(--khipu-dark-muted-soft)] group-hover:bg-[var(--khipu-dark-muted)]" : "bg-slate-300 group-hover:bg-slate-400")} />
                    <span className={cn("block h-[3px] w-[3px] rounded-full transition-colors", isDark ? "bg-[var(--khipu-dark-muted-soft)] group-hover:bg-[var(--khipu-dark-muted)]" : "bg-slate-300 group-hover:bg-slate-400")} />
                  </span>
                </div>
              ) : null}
              <div className="space-y-4 p-4">
                {!showHistory ? <FloatingContextSummary viewContext={viewContext} theme={theme} /> : null}
                <FloatingAiAssistantBody
                  key={controllerKey}
                  viewContext={viewContext}
                  reducedMotion={prefersReducedMotion}
                  showHistory={showHistory}
                  onHistoryCountChange={setHistoryCount}
                  initialProvider={khipuSettings.floatingKhipuProvider}
                  theme={theme}
                />
              </div>
            </KhipuChatPanel>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!expanded ? (
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={buttonTransition}>
          <KhipuFloatingButton open={open} onClick={() => onOpenChange(!open)} />
        </motion.div>
      ) : null}
    </div>
  );
}

function FloatingAiAssistantBody({
  viewContext,
  reducedMotion,
  showHistory,
  onHistoryCountChange,
  initialProvider,
  theme,
}: {
  viewContext: ReturnType<typeof useActiveAiViewContext>;
  reducedMotion: boolean | null;
  showHistory: boolean;
  onHistoryCountChange: (count: number) => void;
  initialProvider?: string;
  theme: FloatingKhipuTheme;
}) {
  const controller = useAiAssistantController({
    projectId: viewContext.projectId,
    initialAction: "chat",
    initialContext: viewContext,
    initialProvider,
  });

  useEffect(() => {
    onHistoryCountChange(controller.history.length);
  }, [controller.history.length, onHistoryCountChange]);

  return (
    <AiAssistantPanel
      controller={controller}
      layout="floating"
      reducedMotion={reducedMotion ?? false}
      showHistory={showHistory}
      theme={theme}
    />
  );
}

function FloatingContextSummary({ viewContext, theme }: { viewContext: AiViewContextValue; theme?: string }) {
  const moduleLabel = viewContext.module ?? "Contexto general";
  const detail = viewContext.selectedItem ?? viewContext.viewSummary ?? "Sin seleccion activa";
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "relative rounded-2xl border px-4 py-3 transition-colors duration-300",
        isDark
          ? "border-[var(--khipu-dark-hairline-strong)] bg-[var(--khipu-dark-surface-elevated)]"
          : "border-slate-200 bg-slate-50",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl bg-[var(--khipu-dark-surface-elevated)] transition-opacity duration-300",
          isDark ? "opacity-100" : "opacity-0",
        )}
      />
      <p className={cn("relative z-10 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300", isDark ? "text-[var(--khipu-dark-muted)]" : "text-slate-500")}>{moduleLabel}</p>
      <p className={cn("relative z-10 mt-1 text-sm font-medium transition-colors duration-300", isDark ? "text-[var(--khipu-dark-body-strong)]" : "text-slate-900")}>{detail}</p>
    </div>
  );
}

function readViewContextIdentity(viewContext: AiViewContextValue) {
  return JSON.stringify({
    projectId: viewContext.projectId ?? null,
    project: viewContext.project ?? null,
    module: viewContext.module ?? null,
    selectedItem: viewContext.selectedItem ?? null,
    selectionType: viewContext.selectionType ?? null,
    selectionId: viewContext.selectionId ?? null,
    unit: viewContext.unit ?? null,
    currentCost: viewContext.currentCost ?? null,
    activeTable: viewContext.activeTable ?? null,
    viewSummary: viewContext.viewSummary ?? null,
  });
}
