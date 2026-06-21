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
  // Local state seeded from context, updated via CustomEvent from settings page.
  // This is needed because FloatingAiAssistant renders outside FormattingSettingsProvider
  // (as a sibling of page content in GlobalAiAssistantProvider), so useFormattingSettings()
  // always returns the default context value.
  const [khipuSettings, setKhipuSettings] = useState(formatSettings);
  const { size, onResizeStart } = useResizablePanel("myc-khipu-panel-size-v2", {
    width: khipuSettings.floatingKhipuWidth,
    height: khipuSettings.floatingKhipuHeight,
  });
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [theme, setTheme] = useState<FloatingKhipuTheme>(() => readStoredTheme() ?? khipuSettings.floatingKhipuTheme);

  // Fetch real settings from the API on mount so the floating panel doesn't
  // show factory defaults before the user opens the settings page.
  // Best-effort: if the fetch fails (e.g. unauthenticated landing page),
  // the component keeps the context-seeded defaults.
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
        // Silently keep defaults — the user may not be authenticated yet
      });
    return () => { cancelled = true; };
  }, []);

  // Listen for settings changes broadcast from the settings page.
  // The settings page dispatches a CustomEvent after saving Khipu settings
  // (or general settings from UserSettingsForm), allowing this component to
  // stay in sync even though it's outside FormattingSettingsProvider.
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

  // Sync local theme when settings change externally (e.g., from settings page).
  // Skip the initial mount so localStorage persistence isn't wiped on page load.
  // Clear localStorage so settings-driven changes take priority over stale toggle values on reload.
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
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 450, damping: 30, mass: 0.8 };

  const buttonTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 25 };

  // Apply position and size from settings; expanded spans full viewport
  const positionStyle = POSITION_STYLE[khipuSettings.floatingKhipuPosition];
  const containerStyle = expanded
    ? { position: "fixed" as const, inset: "1rem" }
    : { position: "fixed" as const, ...positionStyle };

  const fontSizeClass = FONT_SIZE_MAP[khipuSettings.floatingKhipuFontSize];

  return (
    <div
      data-khipu-panel
      className={cn(
        "z-[60] flex flex-col gap-3",
        expanded ? "items-stretch" : "items-end",
      )}
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
              {/* Resize grip — top-left corner (hidden in fullscreen) */}
              {!expanded ? (
                <div
                  className="group absolute left-0 top-0 z-10 flex h-8 w-8 cursor-nwse-resize items-start justify-start rounded-tl-3xl pt-0.5 pl-0.5 opacity-0 transition-opacity hover:opacity-100"
                  onMouseDown={onResizeStart}
                  onTouchStart={onResizeStart}
                  aria-label="Redimensionar panel"
                >
                {/* CSS-only grip dots */}
                <span className="flex gap-[2px]">
                  <span className="block h-[3px] w-[3px] rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400" />
                  <span className="block h-[3px] w-[3px] rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400" />
                </span>
                <span className="-mt-[2px] flex gap-[2px]">
                  <span className="block h-[3px] w-[3px] rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400" />
                  <span className="block h-[3px] w-[3px] rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400" />
                </span>
              </div>
              ) : null}
              <div className="space-y-4 p-4">
                {!showHistory ? <FloatingContextSummary viewContext={viewContext} theme={theme} /> : null}
                <FloatingAiAssistantBody key={controllerKey} viewContext={viewContext} reducedMotion={prefersReducedMotion} showHistory={showHistory} onHistoryCountChange={setHistoryCount} initialProvider={khipuSettings.floatingKhipuProvider} />
              </div>
            </KhipuChatPanel>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!expanded ? (
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={buttonTransition}
        >
          <KhipuFloatingButton
            open={open}
            onClick={() => onOpenChange(!open)}
          />
        </motion.div>
      ) : null}
    </div>
  );
}

function FloatingAiAssistantBody({ viewContext, reducedMotion, showHistory, onHistoryCountChange, initialProvider }: { viewContext: ReturnType<typeof useActiveAiViewContext>; reducedMotion: boolean | null; showHistory: boolean; onHistoryCountChange: (count: number) => void; initialProvider?: string }) {
  const controller = useAiAssistantController({
    projectId: viewContext.projectId,
    initialAction: "chat",
    initialContext: viewContext,
    initialProvider,
  });

  useEffect(() => {
    onHistoryCountChange(controller.history.length);
  }, [controller.history.length, onHistoryCountChange]);

  return <AiAssistantPanel controller={controller} layout="floating" reducedMotion={reducedMotion ?? false} showHistory={showHistory} />;
}

function FloatingContextSummary({ viewContext, theme }: { viewContext: AiViewContextValue; theme?: string }) {
  const moduleLabel = viewContext.module ?? "Contexto general";
  const detail = viewContext.selectedItem ?? viewContext.viewSummary ?? "Sin seleccion activa";
  const isDark = theme === "dark";

  return (
    <div className={cn(
      "relative rounded-2xl border px-4 py-3 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] transition-colors duration-300",
      isDark ? "border-slate-700" : "border-slate-200",
    )}>
      {/* Dark gradient overlay — fades in/out via opacity */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,#1e293b_0%,#0f172a_100%)] transition-opacity duration-300",
          isDark ? "opacity-100" : "opacity-0",
        )}
      />
      <p className={cn("relative z-10 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300", isDark ? "text-slate-400" : "text-slate-500")}>{moduleLabel}</p>
      <p className={cn("relative z-10 mt-1 text-sm font-medium transition-colors duration-300", isDark ? "text-slate-100" : "text-slate-900")}>{detail}</p>
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
