"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AiContext } from "@/lib/ai/types";

export type AiViewContextValue = AiContext & {
  projectId?: string;
};

const AiViewContext = createContext<AiViewContextValue>({});

export function AiViewContextProvider({
  children,
  value = {},
}: {
  children: ReactNode;
  value?: AiViewContextValue;
}) {
  return <AiViewContext.Provider value={value}>{children}</AiViewContext.Provider>;
}

export function useActiveAiViewContext() {
  return useContext(AiViewContext);
}
