"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useActiveAiViewContext, type AiViewContextValue } from "@/components/ai/ai-view-context";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { KhipuChatPanel } from "@/components/khipu/KhipuChatPanel";
import { KhipuFloatingButton } from "@/components/khipu/KhipuFloatingButton";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

type FloatingAiAssistantProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FloatingAiAssistant({ open, onOpenChange }: FloatingAiAssistantProps) {
  const viewContext = useActiveAiViewContext();
  const controllerKey = readViewContextIdentity(viewContext);
  const prefersReducedMotion = useReducedMotion();
  const { size, onResizeStart } = useResizablePanel("myc-khipu-panel-size-v2");
  const [expanded, setExpanded] = useState(false);

  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 450, damping: 30, mass: 0.8 };

  const buttonTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 25 };

  // When expanded, the container spans the full viewport like a modal
  const containerStyle = expanded
    ? { position: "fixed" as const, inset: "1rem" }
    : { position: "fixed" as const, right: "1.25rem", bottom: "1.25rem" };

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
              expanded={expanded}
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
                <FloatingContextSummary viewContext={viewContext} />
                <FloatingAiAssistantBody key={controllerKey} viewContext={viewContext} reducedMotion={prefersReducedMotion} />
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

function FloatingAiAssistantBody({ viewContext, reducedMotion }: { viewContext: ReturnType<typeof useActiveAiViewContext>; reducedMotion: boolean | null }) {
  const controller = useAiAssistantController({
    projectId: viewContext.projectId,
    initialAction: "chat",
    initialContext: viewContext,
  });

  return <AiAssistantPanel controller={controller} layout="floating" reducedMotion={reducedMotion ?? false} />;
}

function FloatingContextSummary({ viewContext }: { viewContext: AiViewContextValue }) {
  const moduleLabel = viewContext.module ?? "Contexto general";
  const detail = viewContext.selectedItem ?? viewContext.viewSummary ?? "Sin seleccion activa";

  return (
    <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{moduleLabel}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{detail}</p>
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
