"use client";

import { useState } from "react";
import { BarChart3, BotMessageSquare } from "lucide-react";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { KhipuQualityMetricsPanel } from "@/components/ai/khipu-quality-metrics-panel";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { cn } from "@/lib/utils";
import type { AiContext } from "@/lib/ai/types";

export type AIWorkspaceProps = {
  projectId?: string;
  initialAction?: "chat" | "apu" | "review" | "autocomplete";
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

const TABS = [
  { id: "workspace", label: "Workspace", icon: BotMessageSquare },
  { id: "metrics", label: "Metricas", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AIWorkspace(props: AIWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("workspace");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100/60 p-1 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 sm:flex-none",
                active
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "workspace" ? (
        <AIWorkspaceContent key={props.projectId ? `project:${props.projectId}` : "session"} {...props} />
      ) : (
        <div className="max-w-4xl">
          <KhipuQualityMetricsPanel />
        </div>
      )}
    </div>
  );
}

function AIWorkspaceContent(props: AIWorkspaceProps) {
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
