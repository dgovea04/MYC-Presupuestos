"use client";

import { useMemo, useState } from "react";
import { BarChart3, BotMessageSquare, BrainCircuit } from "lucide-react";
import { AgentWorkspace } from "@/components/ai/AgentWorkspace";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { KhipuQualityMetricsPanel } from "@/components/ai/khipu-quality-metrics-panel";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { KhipuLogo } from "@/components/khipu/KhipuLogo";
import { cn } from "@/lib/utils";
import type { AiContext } from "@/lib/ai/types";

type KhipuMode = "assistant" | "agent" | "metrics";
type AssistantAction = "chat" | "apu" | "review" | "autocomplete";

export type KhipuWorkspaceProps = {
  availableFeatures: string[];
  initialMode?: KhipuMode;
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  initialAction?: AssistantAction;
  initialContext?: AiContext;
  initialChatMessage?: string;
  initialApuDescription?: string;
  initialApuUnit?: string;
  initialReviewSummary?: string;
  initialAutocompleteInput?: string;
};

const DEFAULT_CONTEXT: AiContext = {
  project: "Edificio Multifamiliar",
  module: "APU",
  selectedItem: "Concreto f'c=210",
  unit: "m3",
  currentCost: 420,
  activeTable: "Analisis de precios unitarios",
};

const TAB_CONFIG = {
  assistant: {
    label: "Asistente",
    description: "Chat tecnico, APU, revision y autocompletado.",
    icon: BotMessageSquare,
  },
  agent: {
    label: "Agente",
    description: "Flujos con herramientas, simulacion y aprobaciones.",
    icon: BrainCircuit,
  },
  metrics: {
    label: "Metricas",
    description: "Calidad, feedback y trazabilidad de respuestas.",
    icon: BarChart3,
  },
} as const;

export function KhipuWorkspace(props: KhipuWorkspaceProps) {
  const canUseAssistant = props.availableFeatures.includes("ai.local");
  const canUseAgent = props.availableFeatures.includes("khipu.agent");
  const tabs = useMemo(() => {
    const enabledTabs: KhipuMode[] = [];
    if (canUseAssistant) enabledTabs.push("assistant", "metrics");
    if (canUseAgent) enabledTabs.splice(canUseAssistant ? 1 : 0, 0, "agent");
    return enabledTabs;
  }, [canUseAgent, canUseAssistant]);

  const fallbackMode = tabs[0] ?? "assistant";
  const requestedMode = props.initialMode && tabs.includes(props.initialMode) ? props.initialMode : fallbackMode;
  const [activeMode, setActiveMode] = useState<KhipuMode>(requestedMode);
  const selectedMode = tabs.includes(activeMode) ? activeMode : fallbackMode;

  return (
    <section className="space-y-5" aria-label="Khipu">
      <div className="rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <KhipuLogo showSubtitle size="md" />
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--app-text-muted)]">
              Un solo espacio para consultar, generar, revisar y ejecutar tareas asistidas sobre tus presupuestos.
            </p>
          </div>

          <div className="flex gap-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 shadow-sm">
            {tabs.map((tab) => {
              const config = TAB_CONFIG[tab];
              const Icon = config.icon;
              const active = tab === selectedMode;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={active}
                  title={config.description}
                  className={cn(
                    "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 sm:flex-none",
                    active
                      ? "bg-[var(--app-surface)] text-[var(--app-text-strong)] shadow-sm ring-1 ring-[var(--app-border)]"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text-strong)]",
                  )}
                  onClick={() => setActiveMode(tab)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedMode === "assistant" ? <KhipuAssistantWorkspace {...props} /> : null}
      {selectedMode === "agent" ? (
        <AgentWorkspace
          projectId={props.projectId}
          workspaceId={props.workspaceId}
          workspaceName={props.workspaceName}
        />
      ) : null}
      {selectedMode === "metrics" ? (
        <div className="max-w-4xl">
          <KhipuQualityMetricsPanel />
        </div>
      ) : null}
    </section>
  );
}

function KhipuAssistantWorkspace(props: KhipuWorkspaceProps) {
  const controller = useAiAssistantController({
    projectId: props.projectId,
    initialAction: props.initialAction ?? "chat",
    initialContext: props.initialContext ?? DEFAULT_CONTEXT,
  });

  return (
    <AiAssistantPanel
      controller={controller}
      initialAutocompleteInput={props.initialAutocompleteInput}
      initialApuDescription={props.initialApuDescription}
      initialApuUnit={props.initialApuUnit}
      initialChatMessage={props.initialChatMessage}
      initialReviewSummary={props.initialReviewSummary}
      layout="page"
      projectId={props.projectId}
    />
  );
}
