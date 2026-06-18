"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AiContext } from "@/lib/ai/types";

export type AiViewContextValue = AiContext;

type AiViewContextRegistry = {
  clear: (publisherId: symbol) => void;
  publish: (publisherId: symbol, value: AiViewContextValue) => void;
};

const AiViewContext = createContext<AiViewContextValue>({});
const AiViewContextRegistry = createContext<AiViewContextRegistry | null>(null);

export function AiViewContextProvider({
  children,
  value = {},
}: {
  children: ReactNode;
  value?: AiViewContextValue;
}) {
  const [publishedState, setPublishedState] = useState<{ publisherId: symbol; value: AiViewContextValue } | null>(null);
  const registry = useMemo<AiViewContextRegistry>(() => ({
    publish: (publisherId, nextValue) => {
      setPublishedState({ publisherId, value: nextValue });
    },
    clear: (publisherId) => {
      setPublishedState((current) => (current?.publisherId === publisherId ? null : current));
    },
  }), []);
  const activeValue = publishedState?.value ?? value;

  return (
    <AiViewContextRegistry.Provider value={registry}>
      <AiViewContext.Provider value={activeValue}>{children}</AiViewContext.Provider>
    </AiViewContextRegistry.Provider>
  );
}

export function useActiveAiViewContext() {
  return useContext(AiViewContext);
}

export function usePublishAiViewContext(next: AiViewContextValue) {
  const registry = useContext(AiViewContextRegistry);
  const publisherId = useRef(Symbol("ai-view-context"));

  useEffect(() => {
    if (!registry) {
      return;
    }

    const activePublisherId = publisherId.current;

    registry.publish(activePublisherId, next);

    return () => {
      registry.clear(activePublisherId);
    };
  }, [next, registry]);
}
