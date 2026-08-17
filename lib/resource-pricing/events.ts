import type { ResourcePriceStreamEvent } from "@/types/resource-pricing";

type Listener = (event: ResourcePriceStreamEvent) => void;
const listeners = new Map<string, Set<Listener>>();

export function publishResourcePriceEvent(event: ResourcePriceStreamEvent) {
  for (const listener of listeners.get(event.requestId) ?? []) {
    listener(event);
  }
}

export function subscribeResourcePriceEvents(requestId: string, listener: Listener) {
  const current = listeners.get(requestId) ?? new Set<Listener>();
  current.add(listener);
  listeners.set(requestId, current);
  return () => {
    current.delete(listener);
    if (current.size === 0) listeners.delete(requestId);
  };
}
