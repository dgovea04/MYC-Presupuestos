"use client";

import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
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

export function AIWorkspace(props: AIWorkspaceProps) {
  return <AIWorkspaceContent key={props.projectId ? `project:${props.projectId}` : "session"} {...props} />;
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
