"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AiContext } from "@/lib/ai/types";

const AiViewContext = createContext<AiContext>({});

export function AiViewContextProvider({ children }: { children: ReactNode }) {
  return <AiViewContext.Provider value={{}}>{children}</AiViewContext.Provider>;
}

export function useActiveAiViewContext() {
  return useContext(AiViewContext);
}
