"use client";

import { usePublishAiViewContext } from "@/components/ai/ai-view-context";
import type { AiContext } from "@/lib/ai/types";

export function useAiViewContext(context: AiContext) {
  usePublishAiViewContext(context);
}

export function AiViewContextBridge({ value }: { value: AiContext }) {
  useAiViewContext(value);
  return null;
}

export { usePublishAiViewContext };
