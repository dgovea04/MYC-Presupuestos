"use client";

import { BotMessageSquare, X } from "lucide-react";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useActiveAiViewContext, type AiViewContextValue } from "@/components/ai/ai-view-context";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FloatingAiAssistantProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FloatingAiAssistant({ open, onOpenChange }: FloatingAiAssistantProps) {
  const viewContext = useActiveAiViewContext();
  const controllerKey = readViewContextIdentity(viewContext);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex items-end justify-end">
      {open ? (
        <Card className="pointer-events-auto w-[min(420px,calc(100vw-2rem))] rounded-3xl border-slate-200 shadow-xl">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Khipu</p>
                <h2 className="text-base font-semibold text-slate-950">Asistente tecnico</h2>
              </div>
              <Button
                data-khipu-close
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-xl p-0"
                aria-label="Cerrar Khipu"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FloatingContextSummary viewContext={viewContext} />
            <FloatingAiAssistantBody key={controllerKey} viewContext={viewContext} />
          </CardContent>
        </Card>
      ) : null}
      <Button
        data-khipu-launcher
        type="button"
        className="pointer-events-auto ml-3 h-14 rounded-2xl px-4 shadow-lg"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <BotMessageSquare className="mr-2 h-5 w-5" />
        Khipu
      </Button>
    </div>
  );
}

function FloatingAiAssistantBody({ viewContext }: { viewContext: ReturnType<typeof useActiveAiViewContext> }) {
  const controller = useAiAssistantController({
    projectId: viewContext.projectId,
    initialAction: "chat",
    initialContext: viewContext,
  });

  return <AiAssistantPanel controller={controller} layout="floating" />;
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
